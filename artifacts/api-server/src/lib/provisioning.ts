import bcrypt from "bcryptjs";
import crypto from "crypto";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { logger } from "./logger";

// db.execute (node-postgres) returns a QueryResult with a `.rows` array.
function toRows(result: unknown): any[] {
  if (Array.isArray(result)) return result;
  const qr = result as { rows?: unknown[] };
  if (Array.isArray(qr?.rows)) return qr.rows as any[];
  return [];
}

export interface ProvisionResult {
  ok: boolean;
  /** Email belongs to a user of a DIFFERENT company — do not auto-login. */
  alreadyExists?: boolean;
  alreadyProvisioned?: boolean;
  companyId?: number;
  userId?: number;
  bulletinId?: number;
  mustSetPassword?: boolean;
  onboardingCompleted?: boolean;
}

function formatBRL(value: number): string {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
  });
}

/**
 * Build a deterministic (NOT AI) "primeiro boletim" personalised to the
 * company: a welcome note + the current top active opportunities + próximos
 * passos. Returns the new bulletin id.
 */
async function createWelcomeBulletin(
  tx: any,
  args: { companyId: number; companyName: string; segmento: string | null },
): Promise<number | undefined> {
  const opps = toRows(
    await tx.execute(sql`
      SELECT title, sector, value, region, deadline
      FROM opportunities
      WHERE status = 'ativa'
      ORDER BY value DESC NULLS LAST
      LIMIT 3
    `),
  ) as Array<{
    title: string;
    sector: string;
    value: number | null;
    region: string;
    deadline: string | null;
  }>;

  const totalActive = toRows(
    await tx.execute(sql`SELECT COUNT(*)::int AS c FROM opportunities WHERE status = 'ativa'`),
  )[0]?.c as number | undefined;

  const seg = args.segmento && args.segmento !== "A confirmar" ? args.segmento : null;

  const summary =
    `Bem-vindo(a) ao Petron Radar, ${args.companyName}! Seu acesso está ativo. ` +
    `Hoje há ${totalActive ?? 0} oportunidade(s) ativa(s) de Óleo & Gás no radar` +
    (seg ? ` — relevantes para o segmento ${seg}.` : ".");

  const lines: string[] = [];
  lines.push(`Olá, equipe ${args.companyName}!`);
  lines.push("");
  lines.push(
    "Este é o seu primeiro boletim no Petron Radar Premium. A partir de agora você acompanha, em um só lugar, as oportunidades de licitação da Petrobras/Petronect com a análise e os próximos passos da nossa equipe.",
  );
  lines.push("");

  if (opps.length > 0) {
    lines.push("OPORTUNIDADES EM DESTAQUE AGORA");
    opps.forEach((o, i) => {
      const parts = [
        `${i + 1}. ${o.title}`,
        `   Setor: ${o.sector} • Região: ${o.region}`,
        `   Valor estimado: ${o.value != null ? formatBRL(o.value) : "a confirmar"}`,
      ];
      if (o.deadline) parts.push(`   Prazo: ${o.deadline}`);
      lines.push(parts.join("\n"));
    });
    lines.push("");
  }

  lines.push("PRÓXIMOS PASSOS");
  lines.push("• Abra o Radar de Oportunidades e filtre por região e setor da sua empresa.");
  lines.push("• Em cada oportunidade, veja a Análise Petron Radar (score + próximos passos) e o checklist de habilitação.");
  lines.push("• Adicione as oportunidades que pretende disputar ao seu Portfólio (Meu Portfólio) e acompanhe cada estágio.");
  lines.push("• Dúvidas? Fale com a nossa equipe pelo WhatsApp de suporte.");

  const content = lines.join("\n");

  const inserted = toRows(
    await tx.execute(sql`
      INSERT INTO bulletins (title, category, summary, content, author, tags, company_id)
      VALUES (
        ${"Bem-vindo à Petron Radar — Seu primeiro boletim"},
        ${"Boas-vindas"},
        ${summary},
        ${content},
        ${"Equipe Petron Radar"},
        ${sql`ARRAY['boas-vindas','onboarding']::text[]`},
        ${args.companyId}
      )
      RETURNING id
    `),
  );
  return inserted[0]?.id as number | undefined;
}

export class ProvisioningError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number = 409,
  ) {
    super(message);
    this.name = "ProvisioningError";
  }
}

export interface PaidCompanyProvisionInput {
  inquiryId?: number;
  razaoSocial: string;
  nomeFantasia: string;
  cnpj: string;
  cidade: string;
  estado: string;
  email: string;
  telefone?: string | null;
  segmento: string;
  socioAdministrador: string;
  adminEmail: string;
  adminName: string;
  planSlug: string;
  paymentAmount: number;
  nextBillingAmount: number;
  renewalDate: string;
}

export interface PaidCompanyProvisionResult {
  companyId: number;
  userId: number;
  temporaryPassword: string;
  adminEmail: string;
  renewalDate: string;
}

type ProvisioningDatabase = Pick<typeof db, "transaction">;
type PasswordRecoveryDatabase = Pick<typeof db, "transaction">;

export interface TemporaryPasswordResult {
  userId: number;
  adminEmail: string;
  temporaryPassword: string;
}

export class TemporaryPasswordReissueInProgressError extends Error {
  constructor() {
    super("Temporary password reissue is already in progress");
    this.name = "TemporaryPasswordReissueInProgressError";
  }
}

const pendingPasswordReissues = new WeakMap<
  object,
  Map<number, { userId: number; promise: Promise<TemporaryPasswordResult | null> }>
>();

/**
 * Replace a selected company administrator's password with a one-time
 * temporary password. Only the hash is persisted; the plaintext is returned
 * to the caller once and is never logged. Concurrent requests in this process
 * share one result. A database advisory lock prevents another process from
 * replacing that credential while it is being issued.
 */
export async function reissueCompanyAdminTemporaryPassword(
  companyId: number,
  adminUserId: number,
  database: PasswordRecoveryDatabase = db,
): Promise<TemporaryPasswordResult | null> {
  let companyRequests = pendingPasswordReissues.get(database);
  if (!companyRequests) {
    companyRequests = new Map();
    pendingPasswordReissues.set(database, companyRequests);
  }

  const pending = companyRequests.get(companyId);
  if (pending) {
    if (pending.userId !== adminUserId) throw new TemporaryPasswordReissueInProgressError();
    return pending.promise;
  }

  const operation = Promise.resolve().then(() => database.transaction(async (tx) => {
    const lockRows = toRows(await tx.execute(sql`
      SELECT pg_try_advisory_xact_lock(710423, ${companyId}::integer) AS locked
    `));
    if (!lockRows[0]?.locked) throw new TemporaryPasswordReissueInProgressError();

    const rows = toRows(await tx.execute(sql`
      SELECT id, email
      FROM company_users
      WHERE company_id = ${companyId} AND id = ${adminUserId} AND role = 'CLIENTE_ADMIN'
      LIMIT 1
      FOR UPDATE
    `));
    const admin = rows[0] as { id: number; email: string } | undefined;
    if (!admin) return null;

    const temporaryPassword = crypto.randomBytes(24).toString("base64url");
    const passwordHash = await bcrypt.hash(temporaryPassword, 12);
    await tx.execute(sql`
      UPDATE company_users
      SET password_hash = ${passwordHash},
          password_enabled = true,
          must_set_password = true,
          onboarding_completed = false
      WHERE id = ${admin.id}
    `);

    return {
      userId: admin.id,
      adminEmail: admin.email,
      temporaryPassword,
    };
  }));
  companyRequests.set(companyId, { userId: adminUserId, promise: operation });

  try {
    return await operation;
  } finally {
    if (companyRequests.get(companyId)?.promise === operation) {
      companyRequests.delete(companyId);
      if (companyRequests.size === 0) pendingPasswordReissues.delete(database);
    }
  }
}

/**
 * Create an offline-paid company, its first CLIENTE_ADMIN, and its active
 * subscription atomically. The random password is returned once and is never
 * persisted in plaintext; the user must replace it on their first login.
 */
export async function provisionPaidCompany(
  input: PaidCompanyProvisionInput,
  database: ProvisioningDatabase = db,
): Promise<PaidCompanyProvisionResult> {
  const temporaryPassword = crypto.randomBytes(24).toString("base64url");
  const passwordHash = await bcrypt.hash(temporaryPassword, 12);
  const normalizedCnpj = input.cnpj.replace(/\D/g, "");
  const normalizedAdminEmail = input.adminEmail.trim().toLowerCase();

  return database.transaction(async (tx) => {
    if (input.inquiryId) {
      const inquiry = toRows(
        await tx.execute(
          sql`SELECT id, status FROM inquiries WHERE id = ${input.inquiryId} FOR UPDATE`,
        ),
      )[0] as { id: number; status: string } | undefined;

      if (!inquiry) {
        throw new ProvisioningError("Solicitação não encontrada", 404);
      }
      if (["ativo", "convertido", "descartado"].includes(inquiry.status.toLowerCase())) {
        throw new ProvisioningError("Esta solicitação já foi concluída ou descartada");
      }
    }

    const existingCompany = toRows(
      await tx.execute(sql`
        SELECT id FROM company_accounts
        WHERE regexp_replace(cnpj, '[^0-9]', '', 'g') = ${normalizedCnpj}
        LIMIT 1
      `),
    )[0];
    if (existingCompany) {
      throw new ProvisioningError("Já existe uma empresa cadastrada com este CNPJ");
    }

    const existingUser = toRows(
      await tx.execute(sql`
        SELECT id FROM company_users
        WHERE lower(email) = ${normalizedAdminEmail}
        LIMIT 1
      `),
    )[0];
    if (existingUser) {
      throw new ProvisioningError("Este e-mail já pertence a um usuário cadastrado");
    }

    const company = toRows(
      await tx.execute(sql`
        INSERT INTO company_accounts
          (razao_social, nome_fantasia, cnpj, cidade, estado, email, telefone,
           segmento, socio_administrador, status)
        VALUES
          (${input.razaoSocial}, ${input.nomeFantasia}, ${normalizedCnpj},
           ${input.cidade}, ${input.estado.toUpperCase()}, ${input.email.trim().toLowerCase()},
           ${input.telefone?.trim() || null}, ${input.segmento}, ${input.socioAdministrador},
           'ativa')
        RETURNING id
      `),
    )[0] as { id: number } | undefined;
    if (!company) {
      throw new Error("Não foi possível criar a empresa");
    }

    const user = toRows(
      await tx.execute(sql`
        INSERT INTO company_users
          (company_id, nome, email, password_hash, role, ativo,
           must_set_password, onboarding_completed)
        VALUES
          (${company.id}, ${input.adminName.trim()}, ${normalizedAdminEmail},
           ${passwordHash}, 'CLIENTE_ADMIN', true, true, false)
        RETURNING id
      `),
    )[0] as { id: number } | undefined;
    if (!user) {
      throw new Error("Não foi possível criar o usuário administrador");
    }

    await tx.execute(sql`
      INSERT INTO subscriptions
        (company_id, plan_slug, status, start_date, renewal_date,
         last_payment_at, last_payment_amount, next_billing_amount)
      VALUES
        (${company.id}, ${input.planSlug}, 'ativo', CURRENT_DATE,
         ${input.renewalDate}::date, NOW(), ${input.paymentAmount},
         ${input.nextBillingAmount})
    `);

    await createWelcomeBulletin(tx, {
      companyId: company.id,
      companyName: input.nomeFantasia,
      segmento: input.segmento,
    });

    if (input.inquiryId) {
      await tx.execute(
        sql`UPDATE inquiries SET status = 'Ativo' WHERE id = ${input.inquiryId}`,
      );
    }

    logger.info(
      { companyId: company.id, userId: user.id, inquiryId: input.inquiryId },
      "Paid company access provisioned by admin",
    );

    return {
      companyId: company.id,
      userId: user.id,
      temporaryPassword,
      adminEmail: normalizedAdminEmail,
      renewalDate: input.renewalDate,
    };
  });
}

/**
 * Provision access for an APPROVED payment. Idempotent and race-safe: the
 * payment row is locked FOR UPDATE and `provisioned_at` guards re-runs, so the
 * webhook and the status poll can both call this safely.
 *
 * Creates/links: company_accounts (by normalised CNPJ), company_users (login,
 * CLIENTE_ADMIN), subscriptions (by company), and a personalised first bulletin.
 *
 * If the payer email already belongs to a user of a DIFFERENT company, it does
 * NOT touch that account (no password/company overwrite) and returns
 * `alreadyExists` so the caller routes the buyer to normal login.
 */
export async function provisionAccessForPayment(
  paymentId: number,
  database: ProvisioningDatabase = db,
): Promise<ProvisionResult> {
  try {
    return await database.transaction(async (tx) => {
      const payment = toRows(
        await tx.execute(sql`SELECT * FROM payments WHERE id = ${paymentId} FOR UPDATE`),
      )[0] as
        | {
            id: number;
            status: string;
            inquiry_id: number | null;
            plan_slug: string;
            amount: number;
            payer_email: string | null;
            payer_name: string | null;
            payer_cnpj: string | null;
            provisioned_at: string | null;
            provisioned_user_id: number | null;
          }
        | undefined;

      if (!payment) return { ok: false };
      if (payment.status !== "approved") return { ok: false };

      // ── Already provisioned → return existing linkage (idempotent) ──────────
      if (payment.provisioned_at) {
        if (!payment.provisioned_user_id) {
          return { ok: false, alreadyExists: true, alreadyProvisioned: true };
        }
        const u = toRows(
          await tx.execute(sql`
            SELECT id, company_id, must_set_password, onboarding_completed
            FROM company_users WHERE id = ${payment.provisioned_user_id} LIMIT 1
          `),
        )[0] as
          | { id: number; company_id: number; must_set_password: boolean; onboarding_completed: boolean }
          | undefined;
        if (!u) return { ok: false, alreadyProvisioned: true };
        return {
          ok: true,
          alreadyProvisioned: true,
          companyId: u.company_id,
          userId: u.id,
          mustSetPassword: u.must_set_password,
          onboardingCompleted: u.onboarding_completed,
        };
      }

      // ── Resolve buyer identity (inquiry first, payer_* fallback) ────────────
      let companyName: string | null = null;
      let cnpj: string | null = null;
      let contactName: string | null = null;
      let email: string | null = null;
      let segmento: string | null = null;
      let whatsapp: string | null = null;
      let cidade = "A confirmar";
      let estado = "A confirmar";

      if (payment.inquiry_id) {
        const iq = toRows(
          await tx.execute(sql`SELECT * FROM inquiries WHERE id = ${payment.inquiry_id} LIMIT 1`),
        )[0] as
          | {
              company_name: string;
              cnpj: string;
              contact_name: string;
              email: string;
              segment: string;
              whatsapp: string;
              cidade?: string;
              estado?: string;
            }
          | undefined;
        if (iq) {
          companyName = iq.company_name;
          cnpj = iq.cnpj;
          contactName = iq.contact_name;
          email = iq.email;
          segmento = iq.segment;
          whatsapp = iq.whatsapp;
          cidade = iq.cidade || cidade;
          estado = iq.estado || estado;
        }
      }

      email = email ?? payment.payer_email;
      cnpj = cnpj ?? payment.payer_cnpj;
      contactName = contactName ?? payment.payer_name;
      companyName = companyName ?? payment.payer_name ?? "Nova Empresa";

      if (!email) {
        logger.warn({ paymentId }, "Provisioning skipped: no email on payment/inquiry");
        return { ok: false };
      }

      const cnpjDigits = (cnpj ?? "").replace(/\D/g, "");
      const priorUser = toRows(await tx.execute(sql`
        SELECT id FROM company_users WHERE lower(email) = lower(${email}) LIMIT 1
      `))[0];
      if (priorUser) {
        await tx.execute(sql`UPDATE payments SET provisioned_at = NOW() WHERE id = ${paymentId}`);
        return { ok: false, alreadyExists: true };
      }

      // ── Company: match by normalised CNPJ, else create ─────────────────────
      let companyId: number | undefined;
      if (cnpjDigits) {
        companyId = toRows(
          await tx.execute(sql`
            SELECT id FROM company_accounts
            WHERE regexp_replace(cnpj, '[^0-9]', '', 'g') = ${cnpjDigits}
            LIMIT 1
          `),
        )[0]?.id as number | undefined;
      }

      if (companyId) {
        // Public checkout is not proof of authority over an existing company.
        await tx.execute(sql`UPDATE payments SET provisioned_at = NOW() WHERE id = ${paymentId}`);
        return { ok: false, alreadyExists: true, companyId };
      } else {
        const cnpjToStore = cnpj && cnpjDigits ? cnpj : `PENDENTE-${paymentId}`;
        companyId = toRows(
          await tx.execute(sql`
            INSERT INTO company_accounts
              (razao_social, nome_fantasia, cnpj, cidade, estado, email, telefone, segmento, status)
            VALUES
              (${companyName}, ${companyName}, ${cnpjToStore}, ${cidade}, ${estado},
               ${email}, ${whatsapp}, ${segmento ?? "A confirmar"}, ${"ativa"})
            RETURNING id
          `),
        )[0]?.id as number | undefined;
      }

      if (!companyId) {
        logger.error({ paymentId }, "Provisioning failed: could not resolve company");
        return { ok: false };
      }

      // ── User: by email. Never hijack a user of another company. ────────────
      const existingUser = toRows(
        await tx.execute(sql`
          SELECT id, company_id FROM company_users WHERE lower(email) = lower(${email}) LIMIT 1
        `),
      )[0] as { id: number; company_id: number } | undefined;

      let userId: number;
      let mustSetPassword: boolean;
      let onboardingCompleted = false;

      if (existingUser) {
        if (existingUser.company_id !== companyId) {
          // Email belongs to a different company — do NOT overwrite anything.
          await tx.execute(sql`UPDATE payments SET provisioned_at = NOW() WHERE id = ${paymentId}`);
          return { ok: false, alreadyExists: true, companyId };
        }
        userId = existingUser.id;
        await tx.execute(sql`UPDATE company_users SET ativo = true WHERE id = ${userId}`);
        const flags = toRows(
          await tx.execute(sql`
            SELECT must_set_password, onboarding_completed FROM company_users WHERE id = ${userId} LIMIT 1
          `),
        )[0] as { must_set_password: boolean; onboarding_completed: boolean } | undefined;
        mustSetPassword = flags?.must_set_password ?? false;
        onboardingCompleted = flags?.onboarding_completed ?? false;
      } else {
        const randomPw = crypto.randomBytes(24).toString("hex");
        const hash = await bcrypt.hash(randomPw, 10);
        userId = toRows(
          await tx.execute(sql`
            INSERT INTO company_users
              (company_id, nome, email, password_hash, role, ativo, must_set_password, onboarding_completed)
            VALUES
              (${companyId}, ${contactName ?? "Administrador"}, ${email}, ${hash},
               ${"CLIENTE_ADMIN"}, true, true, false)
            RETURNING id
          `),
        )[0]?.id as number;
        mustSetPassword = true;
      }

      // ── Subscription: upsert by company ────────────────────────────────────
      await tx.execute(sql`
        INSERT INTO subscriptions
          (company_id, plan_slug, status, start_date, renewal_date, last_payment_at, last_payment_amount)
        VALUES
          (${companyId}, ${payment.plan_slug}, ${"ativo"}, CURRENT_DATE,
           (CURRENT_DATE + INTERVAL '30 days')::date, NOW(), ${payment.amount})
        ON CONFLICT (company_id) DO UPDATE SET
          plan_slug = EXCLUDED.plan_slug,
          status = 'ativo',
          renewal_date = (CURRENT_DATE + INTERVAL '30 days')::date,
          last_payment_at = NOW(),
          last_payment_amount = EXCLUDED.last_payment_amount,
          updated_at = NOW()
      `);

      // ── Primeiro boletim (only created once, guarded by provisioned_at) ─────
      const bulletinId = await createWelcomeBulletin(tx, { companyId, companyName, segmento });

      await tx.execute(sql`
        UPDATE payments SET provisioned_at = NOW(), provisioned_user_id = ${userId},
          new_account_created = ${!existingUser} WHERE id = ${paymentId}
      `);

      logger.info({ paymentId, companyId, userId }, "Access provisioned for payment");
      return { ok: true, companyId, userId, bulletinId, mustSetPassword, onboardingCompleted };
    });
  } catch (err) {
    logger.error({ err, paymentId }, "Provisioning transaction failed");
    return { ok: false };
  }
}
