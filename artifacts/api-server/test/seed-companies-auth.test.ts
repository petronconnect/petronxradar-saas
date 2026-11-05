import assert from "node:assert/strict";
import { once } from "node:events";
import bcrypt from "bcryptjs";
import { test } from "node:test";
import express from "express";
import session from "express-session";
import { createAuthRouter } from "../src/routes/auth";
import seedCompaniesRouter, {
  createSeedCompaniesRouter,
  isBootstrapAuthorized,
} from "../src/routes/seed-companies";
import { executeFakeFailureLimiterQuery } from "./fake-failure-limiter";

const validToken = "this-is-a-test-bootstrap-token-with-at-least-32-bytes";

function compileQuery(query: any): { text: string; params: unknown[] } {
  let text = "";
  const params: unknown[] = [];
  const append = (chunks: any[]) => {
    for (const chunk of chunks) {
      if (Array.isArray(chunk?.value)) text += chunk.value.join("");
      else if (Array.isArray(chunk?.queryChunks)) append(chunk.queryChunks);
      else {
        params.push(chunk && typeof chunk === "object" && "value" in chunk ? chunk.value : chunk);
        text += `$${params.length}`;
      }
    }
  };
  append(query.queryChunks);
  return { text: text.replace(/\s+/g, " ").trim().toLowerCase(), params };
}

async function startServer(app: express.Express) {
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  assert(address && typeof address !== "string");
  return {
    url: `http://127.0.0.1:${address.port}`,
    close: () => new Promise<void>((resolve, reject) =>
      server.close((error) => error ? reject(error) : resolve()),
    ),
  };
}

function createSeedDatabase() {
  const companies: { id: number; cnpj: string; name: string }[] = [];
  const users: {
    company_id: number;
    nome: string;
    email: string;
    password_hash: string;
    role: string;
    ativo: boolean;
    must_set_password: boolean;
    onboarding_completed: boolean;
  }[] = [];
  let nextCompanyId = 1;
  const authFailureLimits = new Map<string, Record<string, any>>();

  return {
    companies,
    users,
    database: {
      execute: async (query: any) => {
        const limiterQuery = executeFakeFailureLimiterQuery(query, authFailureLimits);
        if (limiterQuery.handled) return limiterQuery.result;
        const { text, params } = compileQuery(query);
        if (text.includes("from company_users cu") && text.includes("join company_accounts ca")) {
          const email = String(params[0]).toLowerCase();
          const user = users.find((item) => item.email.toLowerCase() === email);
          if (!user) return { rows: [] };
          const company = companies.find((item) => item.id === user.company_id);
          if (!company) return { rows: [] };
          return {
            rows: [{
              id: users.indexOf(user) + 1,
              email: user.email,
              nome: user.nome,
              role: user.role,
              password_hash: user.password_hash,
              ativo: user.ativo,
              company_id: user.company_id,
              must_set_password: user.must_set_password,
              onboarding_completed: user.onboarding_completed,
              company_name: company.name,
            }],
          };
        }
        if (text.startsWith("update company_users set last_login_at")) return { rows: [] };
        throw new Error(`Unhandled seed auth test query: ${text}`);
      },
      transaction: async (callback: (tx: { execute: (query: any) => Promise<{ rows: any[] }> }) => Promise<unknown>) =>
        callback({
          execute: async (query: any) => {
            const limiterQuery = executeFakeFailureLimiterQuery(query, authFailureLimits);
            if (limiterQuery.handled) return limiterQuery.result;
            const { text, params } = compileQuery(query);
            if (text.startsWith("select count(*)::int as c from company_users")) {
              return { rows: [{ c: users.length }] };
            }
            if (text.startsWith("select id from company_accounts where cnpj")) {
              const company = companies.find((item) => item.cnpj === String(params[0]));
              return { rows: company ? [{ id: company.id }] : [] };
            }
            if (text.startsWith("insert into company_accounts")) {
              const company = {
                id: nextCompanyId++,
                cnpj: String(params[2]),
                name: String(params[1]),
              };
              companies.push(company);
              return { rows: [{ id: company.id }] };
            }
            if (text.startsWith("insert into subscriptions")) return { rows: [] };
            if (text.startsWith("insert into company_users")) {
              const [companyId, nome, email, passwordHash, role, mustSetPassword, onboardingCompleted] = params;
              users.push({
                company_id: Number(companyId),
                nome: String(nome),
                email: String(email),
                password_hash: String(passwordHash),
                role: String(role),
                ativo: true,
                must_set_password: Boolean(mustSetPassword),
                onboarding_completed: Boolean(onboardingCompleted),
              });
              return { rows: [] };
            }
            throw new Error(`Unhandled seed test query: ${text}`);
          },
        }),
    },
  };
}

test("bootstrap authorization rejects missing or weak server secrets", () => {
  assert.equal(isBootstrapAuthorized(`Bearer ${validToken}`, undefined), false);
  assert.equal(isBootstrapAuthorized(`Bearer ${validToken}`, "short"), false);
});

test("bootstrap authorization requires an exact bearer token match", () => {
  assert.equal(isBootstrapAuthorized(undefined, validToken), false);
  assert.equal(isBootstrapAuthorized(validToken, validToken), false);
  assert.equal(isBootstrapAuthorized("Bearer wrong-token-with-sufficient-length", validToken), false);
  assert.equal(isBootstrapAuthorized(`Bearer ${validToken}`, validToken), true);
});

test("bootstrap returns distinct temporary passwords, stores only hashes, and requires password changes", async () => {
  const previousToken = process.env.BOOTSTRAP_AUTH_TOKEN;
  const previousNodeEnv = process.env.NODE_ENV;
  process.env.BOOTSTRAP_AUTH_TOKEN = validToken;
  process.env.NODE_ENV = "test";

  const { database, users } = createSeedDatabase();
  const app = express();
  app.use(express.json());
  app.use(session({
    secret: "test-only-session-secret",
    resave: false,
    saveUninitialized: false,
  }));
  app.use((req, _res, next) => {
    req.log = { error: () => undefined, warn: () => undefined, info: () => undefined } as never;
    next();
  });
  app.use(createSeedCompaniesRouter(database as never));
  app.use(createAuthRouter(database as never));
  const server = await startServer(app);

  try {
    const response = await fetch(`${server.url}/admin/seed-companies`, {
      method: "POST",
      headers: { authorization: `Bearer ${validToken}` },
    });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("cache-control"), "no-store, private");

    const payload = await response.json() as {
      ok: boolean;
      seeded: number;
      results: {
        companyName: string;
        adminEmail: string;
        temporaryPassword: string;
        mustSetPassword: boolean;
      }[];
    };
    assert.equal(payload.ok, true);
    assert.equal(payload.seeded, users.length);
    assert.equal(payload.results.length, users.length);
    assert.ok(users.length > 1);

    const passwords = payload.results.map(({ temporaryPassword }) => temporaryPassword);
    assert.equal(new Set(passwords).size, passwords.length, "every seeded account gets a distinct password");

    for (const result of payload.results) {
      assert.match(result.temporaryPassword, /^[A-Za-z0-9_-]{32}$/);
      assert.equal(result.mustSetPassword, true);
      assert.ok(!("password_hash" in result));

      const user = users.find(({ email }) => email === result.adminEmail);
      assert(user, `the response user ${result.adminEmail} must be persisted`);
      assert.notEqual(user.password_hash, result.temporaryPassword);
      assert.match(user.password_hash, /^\$2[aby]\$/);
      assert.equal(await bcrypt.compare(result.temporaryPassword, user.password_hash), true);
      assert.equal(user.must_set_password, true);

      const login = await fetch(`${server.url}/auth/login`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email: result.adminEmail,
          password: result.temporaryPassword,
        }),
      });
      assert.equal(login.status, 200);
      assert.equal((await login.json() as { mustSetPassword: boolean }).mustSetPassword, true);
    }
  } finally {
    await server.close();
    if (previousToken === undefined) delete process.env.BOOTSTRAP_AUTH_TOKEN;
    else process.env.BOOTSTRAP_AUTH_TOKEN = previousToken;
    if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previousNodeEnv;
  }
});

test("unauthorized bootstrap requests are rejected before database access", async () => {
  const previousToken = process.env.BOOTSTRAP_AUTH_TOKEN;
  process.env.BOOTSTRAP_AUTH_TOKEN = validToken;

  const app = express();
  app.use((req, _res, next) => {
    req.log = { error: () => undefined, warn: () => undefined } as never;
    next();
  });
  app.use("/api", seedCompaniesRouter);
  const server = app.listen(0, "127.0.0.1");

  try {
    await new Promise<void>((resolve) => server.once("listening", resolve));
    const address = server.address();
    assert(address && typeof address !== "string");

    const response = await fetch(`http://127.0.0.1:${address.port}/api/admin/seed-companies`, {
      method: "POST",
    });
    assert.equal(response.status, 401);
    assert.deepEqual(await response.json(), { ok: false, error: "bootstrap_unauthorized" });
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => error ? reject(error) : resolve()),
    );
    if (previousToken === undefined) delete process.env.BOOTSTRAP_AUTH_TOKEN;
    else process.env.BOOTSTRAP_AUTH_TOKEN = previousToken;
  }
});

test("bootstrap route fails closed when no server secret is configured", async () => {
  const previousToken = process.env.BOOTSTRAP_AUTH_TOKEN;
  delete process.env.BOOTSTRAP_AUTH_TOKEN;

  const app = express();
  app.use((req, _res, next) => {
    req.log = { error: () => undefined, warn: () => undefined } as never;
    next();
  });
  app.use("/api", seedCompaniesRouter);
  const server = app.listen(0, "127.0.0.1");

  try {
    await new Promise<void>((resolve) => server.once("listening", resolve));
    const address = server.address();
    assert(address && typeof address !== "string");

    const response = await fetch(`http://127.0.0.1:${address.port}/api/admin/seed-companies`, {
      method: "POST",
      headers: { authorization: `Bearer ${validToken}` },
    });
    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), { ok: false, error: "bootstrap_unavailable" });
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => error ? reject(error) : resolve()),
    );
    if (previousToken !== undefined) process.env.BOOTSTRAP_AUTH_TOKEN = previousToken;
  }
});
