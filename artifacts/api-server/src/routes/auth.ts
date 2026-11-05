import { Router, type Request, type Response, type IRouter } from "express";
import bcrypt from "bcryptjs";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { db, sql } from "@workspace/db";
import { requireAdmin, requireAuth } from "../lib/auth";
import { regenerateSession } from "../lib/auth-session";
import { FailureLimiter } from "../lib/failure-limiter";
import { recordSuccessfulLogin } from "../lib/client-first-access";

function toRows(result: any): any[] {
  if (Array.isArray(result)) return result;
  if (result && Array.isArray(result.rows)) return result.rows;
  return [];
}

function saveSession(req: Request): Promise<void> {
  return new Promise((resolve, reject) =>
    req.session.save((err) => (err ? reject(err) : resolve())),
  );
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const LOGIN_FAILURE_WINDOW_MS = 15 * 60 * 1000;
const RECOVERY_HISTORY_PAGE_SIZE = 20;
const RECOVERY_HISTORY_MAX_PAGE_SIZE = 100;
const RECOVERY_AUDIT_STALE_AFTER_MS = 30 * 60 * 1000;
const DUMMY_PASSWORD_HASH = bcrypt.hashSync("petron-radar-invalid-login-dummy", 12);

class AdminRecoveryUnavailableError extends Error {}

type AuthDatabase = Pick<typeof db, "execute" | "transaction">;

function privateKey(prefix: string, value: string): string {
  return `${prefix}:${createHash("sha256").update(value).digest("hex")}`;
}

function sendInvalidCredentials(res: Response): void {
  res.status(401).json({ error: "Credenciais inválidas" });
}

function sendTemporarilyBlocked(res: Response, remainingMs: number): void {
  res.set("Retry-After", String(Math.max(1, Math.ceil(remainingMs / 1000))));
  res.status(429).json({ error: "Muitas tentativas. Tente novamente mais tarde." });
}

function parsePositiveInteger(value: unknown, fallback: number): number | null {
  if (value === undefined) return fallback;
  if (typeof value !== "string" || !/^[1-9]\d*$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

export function createAuthRouter(database: AuthDatabase = db): IRouter {
const router: IRouter = Router();
router.use("/auth", (_req, res, next) => {
  res.set("Cache-Control", "no-store, private");
  next();
});
const loginByIp = new FailureLimiter(database, 20, LOGIN_FAILURE_WINDOW_MS, 15 * 60 * 1000, 60 * 60 * 1000);
const loginByAccount = new FailureLimiter(database, 5, LOGIN_FAILURE_WINDOW_MS, 30 * 1000, 15 * 60 * 1000);
const adminRecoveryByIp = new FailureLimiter(database, 5, LOGIN_FAILURE_WINDOW_MS, 60 * 1000, 30 * 60 * 1000);

router.post("/auth/admin/recover", async (req: Request, res: Response): Promise<void> => {
  const auditRows = toRows(await database.execute(sql`
    INSERT INTO admin_recovery_audit (result)
    VALUES ('in_progress')
    RETURNING id
  `)) as { id: number }[];
  const auditId = auditRows[0]?.id;
  if (!auditId) {
    req.log.error("ADMIN_PETRON recovery attempt could not be recorded");
    res.status(503).json({ error: "Recuperação temporariamente indisponível" });
    return;
  }

  const updateAuditResult = async (result: string): Promise<void> => {
    const updated = toRows(await database.execute(sql`
      UPDATE admin_recovery_audit
      SET result = ${result}
      WHERE id = ${auditId} AND result = 'in_progress'
      RETURNING id
    `));
    if (updated.length !== 1) {
      throw new Error("Administrative recovery audit result could not be saved");
    }
  };

  const configuredToken = process.env.ADMIN_RECOVERY_TOKEN;
  const authorization = req.get("authorization") ?? "";
  const providedToken = /^Bearer ([^\s]+)$/i.exec(authorization)?.[1];
  const tokenConfigured = !(
    process.env.NODE_ENV !== "production" ||
    !req.secure ||
    !configuredToken ||
    Buffer.byteLength(configuredToken, "utf8") < 32
  );

  let validToken = false;
  if (tokenConfigured && providedToken && configuredToken) {
    const expectedDigest = createHash("sha256").update(configuredToken).digest();
    const providedDigest = createHash("sha256").update(providedToken).digest();
    validToken = timingSafeEqual(expectedDigest, providedDigest);
  }

  const recoveryIpKey = privateKey("ip", req.ip ?? req.socket.remoteAddress ?? "unknown");
  if (!validToken) {
    const remainingMs = await adminRecoveryByIp.remainingMs(recoveryIpKey);
    if (remainingMs > 0) {
      await updateAuditResult("rate_limited");
      res.status(404).json({ error: "Recuperação indisponível ou credencial inválida" });
      return;
    }
    await adminRecoveryByIp.recordFailure(recoveryIpKey);
    await updateAuditResult("invalid_credential");
    res.status(404).json({ error: "Recuperação indisponível ou credencial inválida" });
    return;
  }
  // A valid recovery credential remains usable even if this IP previously made
  // invalid requests, preserving the authorized recovery path.
  await adminRecoveryByIp.clear(recoveryIpKey);

  let temporaryPassword: string;
  try {
    temporaryPassword = randomBytes(24).toString("base64url");
    const passwordHash = await bcrypt.hash(temporaryPassword, 12);
    await database.transaction(async (tx) => {
        const lockedAudit = toRows(await tx.execute(sql`
          SELECT id
          FROM admin_recovery_audit
          WHERE id = ${auditId} AND result = 'in_progress'
          FOR UPDATE
        `));
        if (lockedAudit.length !== 1) {
          throw new Error("Administrative recovery audit attempt is no longer active");
        }

      const admins = toRows(await tx.execute(sql`
        SELECT cu.id, cu.ativo
        FROM company_users cu
        JOIN company_accounts ca ON ca.id = cu.company_id
        WHERE cu.role = 'ADMIN_PETRON'
        ORDER BY cu.id
        LIMIT 2
        FOR UPDATE OF cu
      `)) as { id: number; ativo: boolean }[];

      if (admins.length !== 1 || !admins[0].ativo) {
        throw new AdminRecoveryUnavailableError();
      }

      const adminId = admins[0].id;
      const updated = toRows(await tx.execute(sql`
        UPDATE company_users
        SET password_hash = ${passwordHash}, must_set_password = true
        WHERE id = ${adminId} AND role = 'ADMIN_PETRON' AND ativo = true
        RETURNING id
      `));
      if (updated.length !== 1) {
        throw new AdminRecoveryUnavailableError();
      }

      // Revoke only sessions belonging to the recovered administrator.
      await tx.execute(sql`
        DELETE FROM "session"
        WHERE sess->'user'->>'id' = ${String(adminId)}
      `);
      const auditUpdated = toRows(await tx.execute(sql`
        UPDATE admin_recovery_audit
        SET result = 'success'
        WHERE id = ${auditId}
        RETURNING id
      `));
      if (auditUpdated.length !== 1) {
        throw new Error("Administrative recovery audit result could not be saved");
      }
    });
    req.log.warn("ADMIN_PETRON password recovery completed");
  } catch (error) {
    if (error instanceof AdminRecoveryUnavailableError) {
      await updateAuditResult("unavailable");
      res.status(409).json({ error: "Conta administrativa indisponível para recuperação" });
      return;
    }
    try {
      await updateAuditResult("error");
    } catch (auditError) {
      req.log.error({ err: auditError }, "ADMIN_PETRON recovery failure could not be recorded");
    }
    throw error;
  }

  res.set("Cache-Control", "no-store, private").json({ temporaryPassword });
});

router.get(
  "/auth/admin/recovery-history",
  requireAuth,
  requireAdmin,
  async (req: Request, res: Response): Promise<void> => {
    const page = parsePositiveInteger(req.query.page, 1);
    const pageSize = parsePositiveInteger(req.query.pageSize, RECOVERY_HISTORY_PAGE_SIZE);
    if (
      page === null ||
      pageSize === null ||
      pageSize > RECOVERY_HISTORY_MAX_PAGE_SIZE ||
      !Number.isSafeInteger((page - 1) * pageSize)
    ) {
      res.status(400).json({ error: "Parâmetros de paginação inválidos" });
      return;
    }

    await database.execute(sql`
      WITH stale_attempts AS (
        SELECT id
        FROM admin_recovery_audit
        WHERE result = 'in_progress'
          AND attempted_at < now() - (${RECOVERY_AUDIT_STALE_AFTER_MS} * interval '1 millisecond')
        FOR UPDATE SKIP LOCKED
      )
      UPDATE admin_recovery_audit AS audit
      SET result = 'interrupted'
      FROM stale_attempts
      WHERE audit.id = stale_attempts.id
        AND audit.result = 'in_progress'
    `);

    const countRows = toRows(await database.execute(sql`
      SELECT COUNT(*)::int AS total
      FROM admin_recovery_audit
    `)) as { total: number | string }[];
    const total = Number(countRows[0]?.total ?? 0);
    const rows = toRows(await database.execute(sql`
      SELECT id, attempted_at AS "attemptedAt", result
      FROM admin_recovery_audit
      ORDER BY attempted_at DESC, id DESC
      LIMIT ${pageSize}
      OFFSET ${(page - 1) * pageSize}
    `)) as { id: number; attemptedAt: Date | string; result: string }[];

    res.set("Cache-Control", "no-store, private").json({
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
      attempts: rows.map(({ id, attemptedAt, result }) => ({
        id,
        attemptedAt,
        result,
      })),
    });
  },
);

router.post("/auth/login", async (req: Request, res: Response): Promise<void> => {
  const body = (req.body ?? {}) as { email?: unknown; password?: unknown };
  const email = typeof body.email === "string" ? body.email.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";
  const normalizedEmail = email.toLowerCase();
  const ipKey = privateKey("ip", req.ip ?? req.socket.remoteAddress ?? "unknown");
  const accountKey = privateKey("account", normalizedEmail);

  const ipReservationDelay = await loginByIp.reserve(ipKey);
  if (ipReservationDelay > 0) {
    sendTemporarilyBlocked(res, ipReservationDelay);
    return;
  }
  const accountReservationDelay = await loginByAccount.reserve(accountKey);
  if (accountReservationDelay > 0) {
    await loginByIp.cancel(ipKey);
    sendTemporarilyBlocked(res, accountReservationDelay);
    return;
  }

  const blockedForMs = Math.max(
    await loginByIp.remainingMs(ipKey),
    await loginByAccount.remainingMs(accountKey),
  );
  if (blockedForMs > 0) {
    await loginByIp.cancel(ipKey);
    await loginByAccount.cancel(accountKey);
    sendTemporarilyBlocked(res, blockedForMs);
    return;
  }

  let user: {
    id: number; email: string; nome: string; role: string;
    password_hash: string; password_enabled?: boolean; ativo: boolean; company_id: number;
    must_set_password: boolean; onboarding_completed: boolean; company_name: string;
  } | undefined;
  let validPassword: boolean;
  try {
    const rows = toRows(await database.execute(sql`
      SELECT cu.id, cu.email, cu.nome, cu.role, cu.password_hash, cu.password_enabled, cu.ativo,
             cu.company_id, cu.must_set_password, cu.onboarding_completed,
             ca.nome_fantasia as company_name
      FROM company_users cu
      JOIN company_accounts ca ON ca.id = cu.company_id
      WHERE lower(cu.email) = lower(${normalizedEmail})
      LIMIT 1
    `));

    user = rows[0] as {
      id: number; email: string; nome: string; role: string;
      password_hash: string; ativo: boolean; company_id: number;
      must_set_password: boolean; onboarding_completed: boolean; company_name: string;
    } | undefined;
    validPassword = await bcrypt.compare(password, user?.password_hash ?? DUMMY_PASSWORD_HASH);
  } catch (error) {
    await loginByIp.cancel(ipKey);
    await loginByAccount.cancel(accountKey);
    throw error;
  }

  if (!user || !user.ativo || user.password_enabled === false || !validPassword) {
    const ipBlockMs = await loginByIp.recordFailure(ipKey);
    const accountBlockMs = await loginByAccount.recordFailure(accountKey);
    const newlyBlockedMs = Math.max(ipBlockMs, accountBlockMs);
    if (newlyBlockedMs > 0) {
      sendTemporarilyBlocked(res, newlyBlockedMs);
      return;
    }
    sendInvalidCredentials(res);
    return;
  }

  await loginByIp.clear(ipKey);
  await loginByAccount.clear(accountKey);

  await regenerateSession(req);
  req.session.authenticatedAt = Date.now();
  req.session.authenticationMethod = "password";
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

  await saveSession(req);
  try {
    await recordSuccessfulLogin(database, user.id);
  } catch {
    req.log?.error({ userId: user.id }, "Could not record successful login notification");
  }
  res.set("Cache-Control", "no-store, private").json(req.session.user);
});

router.post("/auth/logout", async (req: Request, res: Response): Promise<void> => {
  try {
    await new Promise<void>((resolve, reject) =>
      req.session.destroy(error => error ? reject(error) : resolve()));
    res.clearCookie("connect.sid", {
      path: "/", httpOnly: true, sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    });
    res.set("Cache-Control", "no-store, private").json({ ok: true });
  } catch {
    res.status(503).json({ error: "Não foi possível encerrar a sessão. Tente novamente." });
  }
});

router.get("/auth/me", requireAuth, async (req: Request, res: Response): Promise<void> => {
  // Refresh onboarding flags from the DB so the welcome gate stays accurate
  // across sessions created before/after onboarding steps.
  const rows = toRows(await database.execute(sql`
    SELECT must_set_password, onboarding_completed, ativo, role, company_id, email, nome
    FROM company_users WHERE id = ${req.session.user!.id} LIMIT 1
  `));
  const flags = rows[0] as { must_set_password: boolean; onboarding_completed: boolean; ativo?: boolean;
    role?: string; company_id?: number; email?: string; nome?: string } | undefined;
  if (!flags || flags.ativo === false) {
    await new Promise<void>((resolve, reject) => req.session.destroy(err => err ? reject(err) : resolve()));
    res.clearCookie("connect.sid", { path: "/" });
    res.status(401).json({ error: "Não autenticado" }); return;
  }
  if (flags) {
    req.session.user!.mustSetPassword = flags.must_set_password;
    req.session.user!.onboardingCompleted = flags.onboarding_completed;
    if (flags.role) req.session.user!.role = flags.role as any;
    if (flags.company_id) req.session.user!.companyId = flags.company_id;
    if (flags.email) req.session.user!.email = flags.email;
    if (flags.nome) req.session.user!.nome = flags.nome;
    await saveSession(req);
  }
  res.json(req.session.user);
});

// Set/replace the logged-in user's password (used by the welcome flow after
// auto-login provisioned the account with a throwaway password).
router.post("/auth/set-password", requireAuth, async (req: Request, res: Response): Promise<void> => {
  const account = toRows(await database.execute(sql`
    SELECT password_enabled FROM company_users WHERE id = ${req.session.user!.id} LIMIT 1
  `))[0];
  if (account?.password_enabled === false &&
      (req.session.authenticationMethod !== "google" ||
       !req.session.authenticatedAt || Date.now() - req.session.authenticatedAt > 10 * 60_000)) {
    res.status(403).json({ error: "Confirme sua identidade Google novamente para definir uma senha." }); return;
  }
  const { password } = req.body as { password?: string };
  if (!password || typeof password !== "string" || password.length < 8) {
    res.status(400).json({ error: "A senha deve ter ao menos 8 caracteres" });
    return;
  }
  const hash = await bcrypt.hash(password, 10);
  await database.execute(sql`
    UPDATE company_users SET password_hash = ${hash}, must_set_password = false, password_enabled = true
    WHERE id = ${req.session.user!.id}
  `);
  req.session.user!.mustSetPassword = false;
  await saveSession(req);
  res.json({ ok: true });
});

// Mark the welcome/tutorial as completed for the logged-in user.
router.post("/auth/complete-onboarding", requireAuth, async (req: Request, res: Response): Promise<void> => {
  await database.execute(sql`
    UPDATE company_users SET onboarding_completed = true WHERE id = ${req.session.user!.id}
  `);
  req.session.user!.onboardingCompleted = true;
  await saveSession(req);
  res.json({ ok: true });
});

// ─── Self-service profile (client edits their OWN data) ──────────────────────
// Returns the logged-in user's editable fields plus read-only company identity.
router.get("/auth/profile", requireAuth, async (req: Request, res: Response): Promise<void> => {
  const u = req.session.user!;
  const rows = toRows(await database.execute(sql`
    SELECT cu.nome, cu.email, cu.role, cu.password_enabled,
           EXISTS (SELECT 1 FROM google_identities gi WHERE gi.user_id = cu.id) AS google_linked,
           ca.id          AS company_id,
           ca.razao_social, ca.nome_fantasia, ca.cnpj,
           ca.cidade, ca.estado,
           ca.email       AS company_email,
           ca.telefone, ca.whatsapp, ca.segmento
    FROM company_users cu
    JOIN company_accounts ca ON ca.id = cu.company_id
    WHERE cu.id = ${u.id}
    LIMIT 1
  `));
  const r = rows[0] as Record<string, any> | undefined;
  if (!r) { res.status(404).json({ error: "Perfil não encontrado" }); return; }
  res.json({
    nome: r.nome,
    email: r.email,
    role: r.role,
    hasPassword: r.password_enabled !== false,
    googleLinked: !!r.google_linked,
    recentAuthentication: !!req.session.authenticatedAt && Date.now() - req.session.authenticatedAt < 10 * 60_000,
    company: {
      id: r.company_id,
      razaoSocial: r.razao_social,
      nomeFantasia: r.nome_fantasia,
      cnpj: r.cnpj,
      cidade: r.cidade,
      estado: r.estado,
      email: r.company_email,
      telefone: r.telefone,
      whatsapp: r.whatsapp,
      segmento: r.segmento,
    },
  });
});

// PATCH only ever touches the session user's own row + own company. IDs come
// from the session, never the body. role/ativo/companyId/cnpj/razaoSocial are
// NOT accepted here. Changing the LOGIN email requires the current password.
router.patch("/auth/profile", requireAuth, async (req: Request, res: Response): Promise<void> => {
  const u = req.session.user!;
  const body = (req.body ?? {}) as {
    nome?: string; email?: string; telefone?: string; whatsapp?: string; currentPassword?: string;
  };

  const nome = typeof body.nome === "string" && body.nome.trim() ? body.nome.trim() : null;
  const telefone = typeof body.telefone === "string" && body.telefone.trim() ? body.telefone.trim() : null;
  const whatsapp = typeof body.whatsapp === "string" && body.whatsapp.trim() ? body.whatsapp.trim() : null;
  const emailRaw = typeof body.email === "string" ? body.email.trim() : undefined;

  if (emailRaw !== undefined && !EMAIL_RE.test(emailRaw)) {
    res.status(400).json({ error: "E-mail inválido" });
    return;
  }
  const emailChanging = emailRaw !== undefined && emailRaw.toLowerCase() !== u.email.toLowerCase();

  if (emailChanging) {
    const account = toRows(await database.execute(sql`
      SELECT password_enabled FROM company_users WHERE id = ${u.id} LIMIT 1
    `))[0];
    const googleProof = account?.password_enabled === false &&
      req.session.authenticationMethod === "google" && !!req.session.authenticatedAt &&
      Date.now() - req.session.authenticatedAt < 10 * 60_000;
    const pw = body.currentPassword;
    if (!googleProof && (!pw || typeof pw !== "string")) {
      res.status(400).json({ error: "Para alterar o e-mail de acesso, confirme sua senha atual" });
      return;
    }
    const pwRows = toRows(await database.execute(sql`
      SELECT password_hash FROM company_users WHERE id = ${u.id} LIMIT 1
    `));
    const hash = pwRows[0]?.password_hash as string | undefined;
    const ok = googleProof || (hash && typeof pw === "string" ? await bcrypt.compare(pw, hash) : false);
    if (!ok) {
      res.status(401).json({ error: "Senha atual incorreta" });
      return;
    }
    const dup = toRows(await database.execute(sql`
      SELECT id FROM company_users WHERE lower(email) = lower(${emailRaw}) AND id <> ${u.id} LIMIT 1
    `));
    if (dup.length > 0) {
      res.status(409).json({ error: "Este e-mail já está em uso por outra conta" });
      return;
    }
  }

  try {
    await database.execute(sql`
      UPDATE company_users SET
        nome  = COALESCE(${nome}, nome),
        email = COALESCE(${emailChanging ? emailRaw! : null}, email)
      WHERE id = ${u.id}
    `);
  } catch (e: any) {
    if (e?.code === "23505") {
      res.status(409).json({ error: "Este e-mail já está em uso por outra conta" });
      return;
    }
    throw e;
  }

  // Keep the company's cadastral email in sync with the login email when it
  // changes, so the client doesn't see a stale "E-mail cadastral da empresa"
  // after updating their login (these accounts are one-CNPJ / one-contact).
  await database.execute(sql`
    UPDATE company_accounts SET
      telefone = COALESCE(${telefone}, telefone),
      whatsapp = COALESCE(${whatsapp}, whatsapp),
      email = COALESCE(${emailChanging ? emailRaw! : null}, email),
      updated_at = NOW()
    WHERE id = ${u.companyId}
  `);

  if (nome) u.nome = nome;
  if (emailChanging) u.email = emailRaw!;
  await saveSession(req);

  res.json({ ok: true });
});

return router;
}

export default createAuthRouter();
