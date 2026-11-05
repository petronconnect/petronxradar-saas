import assert from "node:assert/strict";
import { test } from "node:test";
import { once } from "node:events";
import express from "express";
import session from "express-session";
import { PgDialect } from "drizzle-orm/pg-core";
import { createGoogleRouter } from "../src/routes/google-auth";
import { safeDestination, sessionSecret } from "../src/lib/auth-session";
import { digest } from "../src/lib/payment-recovery";

test("destinations reject external, encoded and auth/API URLs", () => {
  for (const path of ["//evil.test", "/\\evil", "https://evil.test", "/%2f%2fevil", "/api/auth/google/start", "/login", "/\nevil"]) {
    assert.equal(safeDestination(path), "/");
  }
  assert.equal(safeDestination("/oportunidades?sector=gas"), "/oportunidades?sector=gas");
  assert.throws(() => sessionSecret({ NODE_ENV: "production" }));
});

test("Google flow binds browser, consumes state once, rejects invalid/cancelled and never auto-links emails", async () => {
  const flows = new Map<string, any>();
  let linked = false, existing = false, invalid = false, conflict = false;
  const recoveryToken = "a".repeat(64);
  const recoveryPayment = { id: 8, plan_slug: "radar-lancamento", google_subject: "stable-id",
    google_issuer: "https://accounts.google.com", google_email: "user@test.com",
    recovery_token_hash: digest(recoveryToken), recovery_expires_at: new Date(Date.now() + 86400_000) };
  const dialect = new PgDialect();
  const database: any = {
    transaction: async (cb: any) => cb(database),
    execute: async (query: any) => {
      const { sql: text, params: p } = dialect.sqlToQuery(query);
      if (text.includes("SELECT * FROM payments")) return { rows: [recoveryPayment] };
      if (text.includes("INSERT INTO oauth_flows")) {
        flows.set(String(p[0]), { browser: p[1], purpose: p[2], user_id: p[3], nonce: p[4], verifier: p[5], destination: p[6] });
      } else if (text.includes("DELETE FROM oauth_flows WHERE state_hash")) {
        const flow = flows.get(String(p[0]));
        if (flow?.browser === p[1]) { flows.delete(String(p[0])); return { rows: [flow] }; }
      } else if (text.includes("FROM google_identities")) {
        return { rows: linked ? [{ id: 7, role: "CLIENTE_ADMIN", companyId: 42, companyName: "Test", email: "user@test.com" }] : [] };
      } else if (text.includes("SELECT id FROM company_users")) {
        return { rows: existing ? [{ id: 7 }] : [] };
      } else if (text.includes("INSERT INTO google_identities")) {
        if (conflict) throw Object.assign(new Error("conflict"), { code: "23505" });
      } else if (!text.includes("DELETE FROM oauth_flows")) throw new Error("Unexpected query");
      return { rows: [] };
    },
  };
  const app = express();
  app.use(session({ secret: "test-only-google-session", resave: false, saveUninitialized: false }));
  app.use(createGoogleRouter(database, {
    configured: () => true,
    authorize: async proof => `https://provider.test/?state=${proof.state}`,
    verify: async (_url, proof) => {
      assert.ok(proof.nonce && proof.verifier);
      if (invalid) throw new Error("invalid token");
      return { issuer: "https://accounts.google.com", subject: "stable-id", email: "user@test.com" };
    },
  }));
  app.get("/me", (req, res) => res.json(req.session.user ?? null));
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const base = `http://127.0.0.1:${(server.address() as any).port}`;
  const start = async (purpose = "login") => {
    const r = await fetch(`${base}/auth/google/start?purpose=${purpose}&next=/oportunidades`, { redirect: "manual" });
    return {
      state: new URL(r.headers.get("location")!).searchParams.get("state"),
      cookie: r.headers.getSetCookie()[0].split(";")[0],
    };
  };
  const callback = (flow: any, extra = "", cookie = flow.cookie) =>
    fetch(`${base}/auth/google/callback?state=${flow.state}&code=mock${extra}`, { redirect: "manual", headers: { cookie } });
  try {
    const flow = await start();
    assert.match((await callback(flow, "", "")).headers.get("location")!, /google_invalid/);
    assert.match((await callback(flow)).headers.get("location")!, /google_not_linked/);
    assert.match((await callback(flow)).headers.get("location")!, /google_invalid/);
    linked = true;
    const valid = await callback(await start());
    assert.equal(valid.headers.get("location"), "/oportunidades");
    const cookie = valid.headers.getSetCookie()[0].split(";")[0];
    const me = await (await fetch(`${base}/me`, { headers: { cookie } })).json() as any;
    assert.equal(me.companyId, 42);
    assert.equal(me.role, "CLIENTE_ADMIN");
    const linkFlow = await fetch(`${base}/auth/google/start?purpose=link`, {
      redirect: "manual", headers: { cookie },
    });
    existing = true;
    conflict = true;
    const linkState = new URL(linkFlow.headers.get("location")!).searchParams.get("state");
    const linkCookie = linkFlow.headers.getSetCookie()[0]?.split(";")[0] ?? cookie;
    assert.match((await callback({ state: linkState, cookie: linkCookie })).headers.get("location")!, /google_conflict/);
    conflict = false;
    const retryLink = await fetch(`${base}/auth/google/start?purpose=link`, {
      redirect: "manual", headers: { cookie: linkCookie },
    });
    const retryState = new URL(retryLink.headers.get("location")!).searchParams.get("state");
    assert.equal((await callback({ state: retryState, cookie: linkCookie })).headers.get("location"), "/meu-perfil?google=linked");
    existing = false;
    invalid = true;
    assert.match((await callback(await start())).headers.get("location")!, /google_invalid/);
    invalid = false;
    assert.match((await callback(await start(), "&error=access_denied")).headers.get("location")!, /google_cancelled/);
    existing = true;
    assert.match((await callback(await start("register"))).headers.get("location")!, /existing_account/);
    // Approval after the old Google proof expired: receipt authorizes fresh
    // verification of the exact original identity even though user now exists.
    const delayed = await start("register");
    assert.equal((await callback(delayed, "", `${delayed.cookie}; petron_payment_recovery=8.${recoveryToken}`))
      .headers.get("location"), "/checkout/radar-lancamento?resume=1");
    recoveryPayment.google_subject = "different-subject";
    const wrongIdentity = await start("register");
    assert.match((await callback(wrongIdentity, "", `${wrongIdentity.cookie}; petron_payment_recovery=8.${recoveryToken}`))
      .headers.get("location")!, /google_invalid/);
    recoveryPayment.google_subject = "stable-id";
    recoveryPayment.recovery_expires_at = new Date(0);
    const expired = await start("register");
    assert.match((await callback(expired, "", `${expired.cookie}; petron_payment_recovery=8.${recoveryToken}`))
      .headers.get("location")!, /existing_account/);
    existing = false;
    assert.equal((await callback(await start("register"))).headers.get("location"), "/cadastro?google=verified");
    const link = await fetch(`${base}/auth/google/start?purpose=link`, { redirect: "manual" });
    assert.match(link.headers.get("location")!, /recent_login_required/);
  } finally { await new Promise<void>(resolve => server.close(() => resolve())); }
});
