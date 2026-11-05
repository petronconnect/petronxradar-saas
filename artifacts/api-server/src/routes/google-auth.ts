import { Router, type Request, type IRouter } from "express";
import { createHash, randomBytes } from "node:crypto";
import { db, sql } from "@workspace/db";
import type { SessionUser } from "../lib/auth";
import { googleProvider, type GoogleProvider } from "../lib/google-provider";
import { persistSession, regenerateSession, safeDestination } from "../lib/auth-session";
import { readRecovery } from "../lib/payment-recovery";
import { recordSuccessfulLogin } from "../lib/client-first-access";

const digest = (value: string) => createHash("sha256").update(value).digest("hex");
const random = () => randomBytes(32).toString("base64url");
const rows = (result: any): any[] => Array.isArray(result) ? result : result.rows ?? [];
type Database = Pick<typeof db, "execute" | "transaction">;
const recent = (req: Request) => !!req.session.user && !!req.session.authenticatedAt &&
  Date.now() - req.session.authenticatedAt < 10 * 60_000;

export function createGoogleRouter(database: Database = db, provider: GoogleProvider = googleProvider): IRouter {
  const router = Router();
  const starts = new Map<string, { count: number; until: number }>();
  router.get("/auth/options", (_req, res) => {
    res.set("Cache-Control", "no-store").json({ googleAvailable: provider.configured() });
  });
  router.get("/auth/google/start", async (req, res): Promise<void> => {
    const now = Date.now();
    for (const [key, entry] of starts) if (entry.until <= now) starts.delete(key);
    const key = req.ip ?? "unknown";
    const budget = starts.get(key) ?? { count: 0, until: now + 10 * 60_000 };
    if (starts.size >= 10000 || budget.count >= 20) {
      res.set("Retry-After", "600").status(429).json({ error: "Muitas tentativas. Tente novamente mais tarde." }); return;
    }
    budget.count++; starts.set(key, budget);
    const purpose = req.query.purpose ?? "login";
    if (!["login", "register", "link", "reauth"].includes(String(purpose))) {
      res.status(400).json({ error: "Operação inválida" }); return;
    }
    if (!provider.configured()) {
      res.redirect("/login?authError=google_unavailable"); return;
    }
    if ((purpose === "link" && !recent(req)) || (purpose === "reauth" && !req.session.user)) {
      res.redirect("/meu-perfil?authError=recent_login_required"); return;
    }
    // Each browser has one short-lived flow, bounding database growth per session.
    const binding = req.session.oauthBrowserBinding ?? random();
    req.session.oauthBrowserBinding = binding;
    const proof = { state: random(), nonce: random(), verifier: random() };
    const destination = safeDestination(req.query.next);
    let url: string;
    try { url = await provider.authorize(proof); }
    catch { res.redirect("/login?authError=google_unavailable"); return; }
    try {
    await database.transaction(async tx => {
      await tx.execute(sql`DELETE FROM oauth_flows WHERE expires_at < NOW() OR browser_hash = ${digest(binding)}`);
      await tx.execute(sql`
        INSERT INTO oauth_flows (state_hash, browser_hash, purpose, user_id, nonce, verifier, destination, expires_at)
        VALUES (${digest(proof.state)}, ${digest(binding)}, ${String(purpose)}, ${req.session.user?.id ?? null},
          ${proof.nonce}, ${proof.verifier}, ${destination}, NOW() + INTERVAL '10 minutes')
      `);
    });
    await persistSession(req);
    res.redirect(url);
    } catch {
      // Database errors may embed PKCE verifier/nonce parameters.
      // Do not forward those errors to Express's default logger or response.
      res.redirect("/login?authError=google_unavailable");
    }
  });

  router.get("/auth/google/callback", async (req, res): Promise<void> => {
    res.set("Cache-Control", "no-store, private");
    let failureDestination = "/login";
    try {
      const state = req.query.state;
      const binding = req.session.oauthBrowserBinding;
      if (typeof state !== "string" || state.length > 512 || !binding) throw new Error("invalid");
      // Atomic consumption prevents replay, including parallel callbacks.
      const flow = rows(await database.execute(sql`
        DELETE FROM oauth_flows WHERE state_hash = ${digest(state)}
          AND browser_hash = ${digest(binding)} AND expires_at > NOW()
        RETURNING purpose, user_id, nonce, verifier, destination
      `))[0];
      if (!flow) throw new Error("invalid");
      failureDestination = ["link", "reauth"].includes(flow.purpose) ? "/meu-perfil" : "/login";
      if (req.query.error === "access_denied") {
        res.redirect(`${failureDestination}?authError=google_cancelled`); return;
      }
      const identity = await provider.verify(
        new URL(req.originalUrl, "https://callback.invalid"),
        { state, nonce: flow.nonce, verifier: flow.verifier },
      );
      if (flow.purpose === "register") {
        const recovery = await readRecovery(req, database);
        if (recovery?.google_subject) {
          if (recovery.google_subject !== identity.subject || recovery.google_issuer !== identity.issuer ||
              recovery.google_email !== identity.email) throw new Error("invalid identity");
          await regenerateSession(req);
          req.session.googleRegistration = { ...identity, expiresAt: Date.now() + 30 * 60_000 };
          await persistSession(req);
          res.redirect(`/checkout/${encodeURIComponent(recovery.plan_slug)}?resume=1`); return;
        }
        const existing = rows(await database.execute(sql`
          SELECT id FROM company_users WHERE lower(email) = ${identity.email} LIMIT 1
        `));
        if (existing.length) {
          res.redirect("/login?authError=existing_account"); return;
        }
        await regenerateSession(req);
        req.session.googleRegistration = { ...identity, expiresAt: Date.now() + 30 * 60_000 };
        await persistSession(req);
        res.redirect("/cadastro?google=verified"); return;
      }

      if (flow.purpose === "link") {
        if (!recent(req) || flow.user_id !== req.session.user?.id) throw new Error("invalid");
        await database.transaction(async tx => {
          const user = rows(await tx.execute(sql`
            SELECT id FROM company_users WHERE id = ${flow.user_id} AND ativo = true FOR UPDATE
          `))[0];
          if (!user) throw new Error("invalid");
          await tx.execute(sql`
            INSERT INTO google_identities (user_id, issuer, subject)
            VALUES (${user.id}, ${identity.issuer}, ${identity.subject})
          `);
        });
        res.redirect("/meu-perfil?google=linked"); return;
      }

      const user = rows(await database.execute(sql`
        SELECT cu.id, cu.email, cu.nome, cu.role, cu.company_id AS "companyId",
          ca.nome_fantasia AS "companyName", cu.must_set_password AS "mustSetPassword",
          cu.onboarding_completed AS "onboardingCompleted"
        FROM google_identities gi JOIN company_users cu ON cu.id = gi.user_id
        JOIN company_accounts ca ON ca.id = cu.company_id
        WHERE gi.issuer = ${identity.issuer} AND gi.subject = ${identity.subject}
          AND cu.ativo = true AND ca.status = 'ativa' LIMIT 1
      `))[0] as SessionUser | undefined;
      if (!user) {
        res.redirect(`${failureDestination}?authError=google_not_linked`); return;
      }
      if (flow.purpose === "reauth" && (req.session.user?.id !== user.id || flow.user_id !== user.id)) {
        throw new Error("invalid");
      }
      await regenerateSession(req);
      req.session.user = user;
      req.session.authenticatedAt = Date.now();
      req.session.authenticationMethod = "google";
      await persistSession(req);
      if (flow.purpose === "login") {
        try {
          await recordSuccessfulLogin(database, user.id);
        } catch {
          req.log?.error({ userId: user.id }, "Could not record successful login notification");
        }
      }
      res.redirect(flow.purpose === "reauth" ? "/meu-perfil?google=verified" : safeDestination(flow.destination));
    } catch (error) {
      // OAuth exceptions can contain codes/tokens. Never log the exception object.
      const conflict = (error as { code?: string })?.code === "23505";
      res.redirect(`${failureDestination}?authError=${conflict ? "google_conflict" : "google_invalid"}`);
    }
  });
  return router;
}

export default createGoogleRouter();
