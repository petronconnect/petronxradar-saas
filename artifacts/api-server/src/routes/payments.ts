import { Router, type IRouter, type Request, type Response } from "express";
import { MercadoPagoConfig, Payment } from "mercadopago";
import crypto from "crypto";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { provisionAccessForPayment } from "../lib/provisioning";
import { PLAN_PRICE_BY_SLUG } from "./plans";
import { eligibleClaim } from "../lib/payment-claim";
import { issueRecovery, readRecovery, clearRecovery, completeRecoverableClaim } from "../lib/payment-recovery";
import { recordSuccessfulLogin } from "../lib/client-first-access";

const router: IRouter = Router();

// ── MP client (lazy — only initialised when token is present) ─────────────
function getMPClient() {
  const token = process.env.MP_ACCESS_TOKEN;
  if (!token) return null;
  return new MercadoPagoConfig({ accessToken: token });
}

// ── Normalise db.execute result → always an array of rows ─────────────────
// drizzle-orm/node-postgres db.execute() returns pg's QueryResult which has
// a .rows property, not a direct array. This helper normalises both shapes.
function toRows(result: unknown): unknown[] {
  if (Array.isArray(result)) return result;
  const qr = result as { rows?: unknown[] };
  if (Array.isArray(qr?.rows)) return qr.rows;
  return [];
}

// ── Claim token (browser-held one-time secret to claim access post-payment) ─
function generateClaimToken(): { token: string; hash: string } {
  const token = crypto.randomBytes(32).toString("hex");
  const hash = crypto.createHash("sha256").update(token).digest("hex");
  return { token, hash };
}

// ── DB helper: insert a payment row and return its id ─────────────────────
async function insertPayment(params: {
  inquiryId: number | null;
  mpPaymentId: string;
  status: string;
  planSlug: string;
  amount: number;
  pixQrCode: string;
  pixQrCodeBase64: string;
  pixCopyPaste: string;
  payerEmail: string;
  payerName: string;
  payerCnpj: string | null;
  claimTokenHash: string;
}): Promise<number> {
  const result = await db.execute(sql`
    INSERT INTO payments
      (inquiry_id, mp_payment_id, status, plan_slug, amount,
       pix_qr_code, pix_qr_code_base64, pix_copy_paste, payer_email, payer_name,
       payer_cnpj, claim_token_hash)
    VALUES
      (${params.inquiryId}, ${params.mpPaymentId}, ${params.status}, ${params.planSlug},
       ${params.amount}, ${params.pixQrCode}, ${params.pixQrCodeBase64},
       ${params.pixCopyPaste}, ${params.payerEmail}, ${params.payerName},
       ${params.payerCnpj}, ${params.claimTokenHash})
    RETURNING id
  `);
  const row = toRows(result)[0] as { id: number } | undefined;
  return row?.id ?? 0;
}

// ── Sandbox mock payment ───────────────────────────────────────────────────
const MOCK_PIX_KEY =
  "00020126330014BR.GOV.BCB.PIX0111petronradar52040000530398654075000.005802BR5920Petron Radar Premium6009Sao Paulo62140510petronradar6304A1B2";

async function sandboxPayment(params: {
  inquiryId: number | null;
  planSlug: string;
  amount: number;
  payerEmail: string;
  payerName: string;
  payerCnpj: string | null;
  claimTokenHash: string;
  reason?: string;
}) {
  const mpPaymentId = `MOCK-${Date.now()}`;
  const id = await insertPayment({
    inquiryId: params.inquiryId,
    mpPaymentId,
    status: "pending",
    planSlug: params.planSlug,
    amount: params.amount,
    pixQrCode: "",
    pixQrCodeBase64: "",
    pixCopyPaste: MOCK_PIX_KEY,
    payerEmail: params.payerEmail,
    payerName: params.payerName,
    payerCnpj: params.payerCnpj,
    claimTokenHash: params.claimTokenHash,
  });
  return {
    paymentId: id,
    mpPaymentId,
    pixCopyPaste: MOCK_PIX_KEY,
    qrCodeBase64: "",
    amount: params.amount,
    status: "pending",
    sandboxMode: true,
    sandboxReason: params.reason ?? "no_credentials",
  };
}

// ── Webhook signature validation ───────────────────────────────────────────
function validateWebhookSignature(req: Request): boolean {
  const secret = process.env.MP_WEBHOOK_SECRET;
  if (!secret) return true;
  const signatureHeader = req.headers["x-signature"] as string | undefined;
  const requestId = req.headers["x-request-id"] as string | undefined;
  if (!signatureHeader) return false;

  const parts: Record<string, string> = {};
  signatureHeader.split(",").forEach((part) => {
    const [k, v] = part.trim().split("=");
    if (k && v) parts[k] = v;
  });

  const ts = parts["ts"];
  const v1 = parts["v1"];
  if (!ts || !v1) return false;

  const dataId = (req.body as { data?: { id?: string } })?.data?.id ?? "";
  const manifest = `id:${dataId};request-id:${requestId ?? ""};ts:${ts};`;
  const hash = crypto.createHmac("sha256", secret).update(manifest).digest("hex");
  return hash === v1;
}

// ── POST /api/payments/pix ────────────────────────────────────────────────
router.post("/payments/pix", async (req: Request, res: Response): Promise<void> => {
  const {
    inquiryId,
    planSlug,
    payerEmail,
    payerName,
    payerLastName,
    payerCnpj,
  } = (req.body ?? {}) as {
    inquiryId?: number;
    planSlug: string;
    payerEmail: string;
    payerName: string;
    payerLastName?: string;
    payerCnpj?: string;
  };

  if (typeof planSlug !== "string" || typeof payerEmail !== "string" ||
      typeof payerName !== "string" || !planSlug || !payerEmail || !payerName ||
      (payerCnpj !== undefined && typeof payerCnpj !== "string") ||
      (payerLastName !== undefined && typeof payerLastName !== "string") ||
      !Number.isSafeInteger(inquiryId)) {
    res.status(400).json({ error: "Campos obrigatórios faltando." });
    return;
  }

  const registration = req.session.registration;
  if (!registration || registration.expiresAt < Date.now() ||
      registration.inquiryId !== inquiryId || registration.planSlug !== planSlug ||
      registration.email !== payerEmail.trim().toLowerCase() ||
      registration.cnpj !== (payerCnpj ?? "").replace(/\D/g, "")) {
    res.status(403).json({ error: "Conclua o cadastro neste navegador antes de gerar o pagamento." });
    return;
  }
  const google = req.session.googleRegistration;
  if (google && (google.expiresAt < Date.now() || google.email !== registration.email)) {
    res.status(409).json({ error: "Autentique novamente sua identidade Google." });
    return;
  }
  const bindGoogle = async (paymentId: number) => {
    await issueRecovery(paymentId, res);
    if (google) await db.execute(sql`
      UPDATE payments SET google_issuer = ${google.issuer}, google_subject = ${google.subject},
        google_email = ${google.email} WHERE id = ${paymentId}
    `);
  };

  // Server-side pricing — never trust a client-sent amount (otherwise any plan
  // could be bought for R$1). The charged value is resolved from the slug only.
  const amount = PLAN_PRICE_BY_SLUG[planSlug];
  if (amount === undefined) {
    res.status(400).json({ error: "Plano inválido." });
    return;
  }

  const iqId = inquiryId ?? null;
  const cnpjForStore = (payerCnpj ?? "").trim() || null;
  const { token: claimToken, hash: claimTokenHash } = generateClaimToken();
  const mpClient = getMPClient();

  // ── No credentials → sandbox ───────────────────────────────────────────
  if (!mpClient) {
    const data = await sandboxPayment({
      inquiryId: iqId, planSlug, amount, payerEmail, payerName,
      payerCnpj: cnpjForStore, claimTokenHash,
    });
    await bindGoogle(data.paymentId);
    res.json({ ...data, claimToken });
    return;
  }

  // ── Real Mercado Pago Pix ──────────────────────────────────────────────
  try {
    const paymentClient = new Payment(mpClient);
    const cleanCnpj = (payerCnpj ?? "").replace(/\D/g, "");

    const mpPayment = await paymentClient.create({
      body: {
        transaction_amount: amount,
        description: `Petron Radar Premium — ${planSlug}`,
        payment_method_id: "pix",
        payer: {
          email: payerEmail,
          first_name: payerName,
          last_name: payerLastName ?? ".",
          ...(cleanCnpj.length >= 11 && {
            identification: {
              type: cleanCnpj.length === 14 ? "CNPJ" : "CPF",
              number: cleanCnpj,
            },
          }),
        },
      },
    });

    const txData = mpPayment.point_of_interaction?.transaction_data;
    const qrCode = txData?.qr_code ?? "";
    const qrCodeBase64 = txData?.qr_code_base64 ?? "";

    const id = await insertPayment({
      inquiryId: iqId,
      mpPaymentId: String(mpPayment.id),
      status: mpPayment.status ?? "pending",
      planSlug,
      amount,
      pixQrCode: qrCode,
      pixQrCodeBase64: qrCodeBase64,
      pixCopyPaste: qrCode,
      payerEmail,
      payerName,
      payerCnpj: cnpjForStore,
      claimTokenHash,
    });
    await bindGoogle(id);

    res.json({
      paymentId: id,
      mpPaymentId: String(mpPayment.id),
      pixCopyPaste: qrCode,
      qrCodeBase64,
      qrCode,
      amount,
      status: mpPayment.status ?? "pending",
      sandboxMode: false,
      claimToken,
    });
  } catch (err: unknown) {
    // Detect auth / permission errors and degrade gracefully to sandbox
    const e = err as Record<string, unknown>;
    const isAuthError =
      e?.status === 401 ||
      e?.error === "unauthorized" ||
      String(e?.message ?? "").toLowerCase().includes("unauthorized");

    if (isAuthError) {
      req.log.warn(
        { mpError: { status: e?.status, error: e?.error, message: e?.message } },
        "MP auth error — sandbox fallback. Provide a test-user access token or approved production credentials."
      );
      try {
        const data = await sandboxPayment({
          inquiryId: iqId, planSlug, amount, payerEmail, payerName,
          payerCnpj: cnpjForStore, claimTokenHash, reason: "unauthorized",
        });
        await bindGoogle(data.paymentId);
        res.json({ ...data, claimToken });
      } catch (dbErr) {
        req.log.error({ dbErr }, "Sandbox DB insert failed");
        res.json({
          paymentId: 0,
          mpPaymentId: `MOCK-${Date.now()}`,
          pixCopyPaste: MOCK_PIX_KEY,
          qrCodeBase64: "",
          amount,
          status: "pending",
          sandboxMode: true,
          sandboxReason: "unauthorized",
        });
      }
      return;
    }

    const msg = err instanceof Error ? err.message : String(e?.message ?? "Erro ao criar pagamento MP.");
    req.log.error({ err }, "MP payment creation failed");
    res.status(500).json({ error: msg });
  }
});

// ── GET /api/payments/:id/status ──────────────────────────────────────────
// Returns status only (no secrets) — payment id is a guessable serial, so this
// endpoint must never expose the claim token or credentials.
router.get("/payments/recovery", async (req, res): Promise<void> => {
  res.set("Cache-Control", "no-store");
  const payment = await readRecovery(req);
  res.json({ recovery: payment ? { paymentId: payment.id, planSlug: payment.plan_slug,
    status: payment.status, googleRequired: !!payment.google_subject } : null });
});
router.get("/payments/:id/status", async (req: Request, res: Response): Promise<void> => {
  const id = Number(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "ID inválido" }); return; }

  const rawRows = await db.execute(sql`SELECT * FROM payments WHERE id = ${id} LIMIT 1`);
  const payment = toRows(rawRows)[0] as {
    id: number; status: string; mp_payment_id: string;
    plan_slug: string; amount: number; paid_at: string | null;
    provisioned_at: string | null;
  } | undefined;

  if (!payment) { res.status(404).json({ error: "Pagamento não encontrado" }); return; }

  let currentStatus = payment.status;
  let paidAt: string | null = payment.paid_at;

  // Re-check MP for latest status if still pending
  if (
    payment.status === "pending" &&
    payment.mp_payment_id &&
    !payment.mp_payment_id.startsWith("MOCK") &&
    getMPClient()
  ) {
    try {
      const paymentClient = new Payment(getMPClient()!);
      const mp = await paymentClient.get({ id: Number(payment.mp_payment_id) });
      if (mp.status && mp.status !== payment.status) {
        await db.execute(sql`
          UPDATE payments
          SET status = ${mp.status}, paid_at = ${mp.status === "approved" ? sql`NOW()` : sql`NULL`}
          WHERE id = ${id}
        `);
        currentStatus = mp.status;
        paidAt = mp.status === "approved" ? new Date().toISOString() : null;
        if (mp.status === "approved") {
          await db.execute(sql`
            UPDATE inquiries SET status = 'Ativo'
            WHERE id = (SELECT inquiry_id FROM payments WHERE id = ${id})
          `);
        }
      }
    } catch {
      // Ignore MP re-check errors; fall through with DB status
    }
  }

  // Provision access on approval (idempotent; also recovers approved-but-unprovisioned rows)
  if (currentStatus === "approved" && !payment.provisioned_at) {
    await provisionAccessForPayment(id);
  }

  res.json({ status: currentStatus, paidAt });
});

// ── POST /api/payments/:id/claim ──────────────────────────────────────────
// Buyer's browser presents the claim token (held since Pix creation). On a
// valid token for an approved payment we ensure provisioning and log the user
// in (auto-login). The status endpoint exposes no secret, so this is IDOR-safe.
router.post("/payments/:id/claim", async (req: Request, res: Response): Promise<void> => {
  const id = Number(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "ID inválido" }); return; }

  const { claimToken } = req.body ?? {};
  const recovery = await readRecovery(req);
  const recovered = recovery?.id === id;
  if (!recovered && (!claimToken || typeof claimToken !== "string")) {
    res.status(400).json({ ok: false, error: "Token ausente" });
    return;
  }

  const payment = toRows(
    await db.execute(sql`
      SELECT id, status, claim_token_hash, google_subject, google_issuer, google_email FROM payments WHERE id = ${id} LIMIT 1
    `),
  )[0] as any;

  if (!payment) { res.status(404).json({ ok: false, error: "Pagamento não encontrado" }); return; }
  if (payment.status !== "approved") {
    res.status(409).json({ ok: false, error: "Pagamento ainda não confirmado" });
    return;
  }
  if (!recovered && !payment.claim_token_hash) {
    res.status(400).json({ ok: false, error: "Pagamento não elegível para liberação automática" });
    return;
  }

  // Constant-time token comparison
  const providedHash = recovered ? payment.claim_token_hash : crypto.createHash("sha256").update(claimToken).digest("hex");
  const a = Buffer.from(providedHash ?? "", "hex");
  const b = Buffer.from(payment.claim_token_hash ?? "", "hex");
  if (!recovered && (a.length !== b.length || !crypto.timingSafeEqual(a, b))) {
    res.status(403).json({ ok: false, error: "Token inválido" });
    return;
  }

  const googleProof = req.session.googleRegistration;
  if (payment.google_subject && (!googleProof || googleProof.expiresAt <= Date.now() ||
      googleProof.subject !== payment.google_subject || googleProof.issuer !== payment.google_issuer ||
      googleProof.email !== payment.google_email)) {
    res.status(409).json({ ok: false, code: "google_reverification_required",
      error: "Confirme novamente a mesma conta Google para concluir seu acesso. Não é necessário pagar novamente." }); return;
  }
  // Ensure provisioning (idempotent)
  const result = await provisionAccessForPayment(id);

  if (result.alreadyExists) {
    res.json({ ok: false, alreadyExists: true });
    return;
  }
  if (!result.ok || !result.userId) {
    req.log.error({ paymentId: id }, "Claim failed: provisioning did not yield a user");
    res.status(500).json({ ok: false, error: "Falha ao liberar acesso" });
    return;
  }

  // Claim and optional Google link are consumed together under a payment lock.
  // A payment must never grant possession of a pre-existing company/account.
  let claimed: boolean;
  try {
  claimed = await db.transaction(async tx => {
    const row = toRows(await tx.execute(sql`
      SELECT status, new_account_created, google_issuer, google_subject, google_email,
        claim_token_hash, claimed_at FROM payments WHERE id = ${id} FOR UPDATE
    `))[0] as any;
    if (recovered ? (!row?.new_account_created || row.status !== "approved") :
        !eligibleClaim(row, providedHash, req.session.googleRegistration)) return false;
    if (row.google_subject) {
      const proof = req.session.googleRegistration;
      if (!proof || proof.expiresAt < Date.now() || proof.subject !== row.google_subject ||
          proof.issuer !== row.google_issuer || proof.email !== row.google_email) return false;
      const account = toRows(await tx.execute(sql`
        SELECT id FROM company_users WHERE id = ${result.userId}
          AND lower(email) = ${proof.email} AND ativo = true FOR UPDATE
      `))[0];
      if (!account) return false;
      await tx.execute(sql`
        INSERT INTO google_identities (user_id, issuer, subject)
        VALUES (${result.userId}, ${proof.issuer}, ${proof.subject})
        ON CONFLICT (user_id) DO NOTHING
      `);
      const identity = toRows(await tx.execute(sql`SELECT subject FROM google_identities
        WHERE user_id = ${result.userId} AND issuer = ${proof.issuer} AND subject = ${proof.subject}`));
      if (!identity.length) throw new Error("identity conflict");
      await tx.execute(sql`
        UPDATE company_users SET password_enabled = false, must_set_password = false
        WHERE id = ${result.userId}
      `);
    }
    return true;
  });
  } catch {
    res.status(409).json({ ok: false, error: "Não foi possível vincular a identidade ao acesso. Entre na conta existente ou contate o suporte." });
    return;
  }
  if (!claimed) {
    res.status(409).json({ ok: false, error: "Acesso já resgatado ou identidade não elegível. Entre na sua conta." });
    return;
  }

  // Load the user for the session
  const user = toRows(
    await db.execute(sql`
      SELECT cu.id, cu.email, cu.nome, cu.role, cu.company_id,
             cu.must_set_password, cu.onboarding_completed, ca.nome_fantasia AS company_name
      FROM company_users cu
      JOIN company_accounts ca ON ca.id = cu.company_id
        WHERE cu.id = ${result.userId} AND cu.ativo = true LIMIT 1
    `),
  )[0] as {
    id: number; email: string; nome: string; role: string; company_id: number;
    must_set_password: boolean; onboarding_completed: boolean; company_name: string;
  } | undefined;

  if (!user) {
    res.status(500).json({ ok: false, error: "Usuário não encontrado após liberação" });
    return;
  }

  try {
  await completeRecoverableClaim(async () => {
  // Recovery receipt is independent of this session and survives a failed save.
  await new Promise<void>((resolve, reject) =>
    req.session.regenerate((err) => (err ? reject(err) : resolve())),
  );
  req.session.user = {
    id: user.id,
    email: user.email,
    nome: user.nome,
    role: user.role as any,
    companyId: user.company_id,
    companyName: user.company_name,
    mustSetPassword: user.must_set_password,
    onboardingCompleted: user.onboarding_completed,
  };
  req.session.authenticatedAt = Date.now();
  req.session.authenticationMethod = user.must_set_password ? "password" : "google";
  await new Promise<void>((resolve, reject) =>
    req.session.save(err => err ? reject(err) : resolve()));

  }, async () => {
    await db.execute(sql`UPDATE payments SET claimed_at = COALESCE(claimed_at, NOW()),
      claim_token_hash = NULL WHERE id = ${id}`);
  });
  try {
    await recordSuccessfulLogin(db, user.id);
  } catch {
    req.log?.error({ userId: user.id }, "Could not record successful login notification");
  }
  clearRecovery(res);
  res.json({
    ok: true,
    needsPasswordSetup: user.must_set_password,
    companyName: user.company_name,
  });
  } catch {
    res.status(503).json({ ok: false, error: "Pagamento confirmado. Não foi possível salvar o acesso; tente novamente sem pagar outra vez." });
    return;
  }
});

// ── POST /api/payments/webhook ────────────────────────────────────────────
router.post("/payments/webhook", async (req: Request, res: Response): Promise<void> => {
  if (!validateWebhookSignature(req)) {
    res.status(401).json({ error: "Assinatura inválida" });
    return;
  }

  const body = req.body as { type?: string; action?: string; data?: { id?: string } };
  if (body.type !== "payment" && body.action !== "payment.updated") {
    res.json({ received: true }); return;
  }

  const mpId = body.data?.id;
  if (!mpId) { res.json({ received: true }); return; }

  const mpClient = getMPClient();
  if (mpClient) {
    try {
      const paymentClient = new Payment(mpClient);
      const mp = await paymentClient.get({ id: Number(mpId) });
      if (mp.status) {
        await db.execute(sql`
          UPDATE payments
          SET status = ${mp.status}, paid_at = ${mp.status === "approved" ? sql`NOW()` : sql`NULL`}
          WHERE mp_payment_id = ${mpId}
        `);
        if (mp.status === "approved") {
          await db.execute(sql`
            UPDATE inquiries SET status = 'Ativo'
            WHERE id = (SELECT inquiry_id FROM payments WHERE mp_payment_id = ${mpId} LIMIT 1)
          `);
          const pid = toRows(
            await db.execute(sql`SELECT id FROM payments WHERE mp_payment_id = ${mpId} LIMIT 1`),
          )[0] as { id: number } | undefined;
          if (pid) await provisionAccessForPayment(pid.id);
        }
      }
    } catch {
      // Return 200 anyway so MP doesn't retry endlessly
    }
  }

  res.json({ received: true });
});

// ── POST /api/payments/:id/simulate-paid (DEV only) ──────────────────────
router.post("/payments/:id/simulate-paid", async (req: Request, res: Response): Promise<void> => {
  if (process.env.NODE_ENV === "production") {
    res.status(403).json({ error: "Não disponível em produção." }); return;
  }
  const id = Number(req.params.id);
  await db.execute(sql`UPDATE payments SET status = 'approved', paid_at = NOW() WHERE id = ${id}`);
  await db.execute(sql`
    UPDATE inquiries SET status = 'Ativo'
    WHERE id = (SELECT inquiry_id FROM payments WHERE id = ${id} LIMIT 1)
  `);
  const result = await provisionAccessForPayment(id);
  res.json({
    status: "approved",
    simulated: true,
    provisioned: result.ok,
    alreadyExists: result.alreadyExists ?? false,
  });
});

export default router;
