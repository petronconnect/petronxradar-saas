import assert from "node:assert/strict";
import { AsyncLocalStorage } from "node:async_hooks";
import { once } from "node:events";
import express from "express";
import session from "express-session";
import { test } from "node:test";
import productionApp from "../src/app";
import { createAuthRouter } from "../src/routes/auth";
import { createCompaniesRouter } from "../src/routes/companies";
import { provisionPaidCompany } from "../src/lib/provisioning";
import { FakeDatabase } from "./fake-database";
import { executeFakeFailureLimiterQuery } from "./fake-failure-limiter";

function compileQuery(query: any): { text: string; params: unknown[] } {
  let text = "";
  const params: unknown[] = [];

  const append = (chunks: any[]) => {
    for (const chunk of chunks) {
      if (Array.isArray(chunk?.value)) {
        text += chunk.value.join("");
      } else if (Array.isArray(chunk?.queryChunks)) {
        append(chunk.queryChunks);
      } else {
        params.push(chunk && typeof chunk === "object" && "value" in chunk ? chunk.value : chunk);
        text += `$${params.length}`;
      }
    }
  };

  append(query.queryChunks);
  return { text: text.replace(/\s+/g, " ").trim().toLowerCase(), params };
}

const adminSessionUser = {
  id: 1,
  email: "operador@petron.test",
  nome: "Operador Petron",
  role: "ADMIN_PETRON" as const,
  companyId: 1,
  companyName: "Petron Radar",
};

const baseCompanyRequest = {
  razaoSocial: "Indústria Exemplo Ltda",
  nomeFantasia: "Indústria Exemplo",
  cnpj: "12.345.678/0001-90",
  cidade: "Rio de Janeiro",
  estado: "rj",
  email: "financeiro@exemplo.test",
  adminEmail: "admin@exemplo.test",
  adminName: "Ana Administradora",
  segmento: "Serviços industriais",
  planSlug: "radar-lancamento",
  paymentAmount: 500,
};

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

function createCompaniesApp(database: FakeDatabase, routeDatabase: any = database) {
  const app = express();
  app.use(express.json());
  app.use(session({
    secret: "test-only-session-secret",
    resave: false,
    saveUninitialized: true,
  }));
  app.use((req, _res, next) => {
    req.session.user = adminSessionUser;
    next();
  });
  app.use(createCompaniesRouter({
    database: routeDatabase as never,
    provisionPaidCompany: (input) => provisionPaidCompany(input, database as never),
  }));
  return app;
}

function createReissueConnection(database: FakeDatabase, state: { locked: boolean }) {
  return {
    execute: (query: any) => database.execute(query),
    transaction: async (callback: (tx: {
      execute: (query: any) => Promise<{ rows: Record<string, any>[] }>;
    }) => Promise<unknown>) => {
      let acquiredLock = false;
      try {
        return await callback({
          execute: async (query) => {
            const { text } = compileQuery(query);
            if (text.startsWith("select pg_try_advisory_xact_lock")) {
              if (state.locked) return { rows: [{ locked: false }] };
              state.locked = true;
              acquiredLock = true;
              return { rows: [{ locked: true }] };
            }
            return database.execute(query);
          },
        });
      } finally {
        if (acquiredLock) state.locked = false;
      }
    },
  };
}

class ConcurrentPaidCompanyDatabase extends FakeDatabase {
  private readonly transactionChanges = new AsyncLocalStorage<Array<{ rows: any[]; row: any }>>();
  private readonly preflightBarriers = new Map<string, {
    arrivals: number;
    promise: Promise<void>;
    release: () => void;
  }>();

  override async transaction<T>(
    callback: (tx: { execute: (query: any) => Promise<{ rows: Record<string, any>[] }> }) => Promise<T>,
  ): Promise<T> {
    const changes: Array<{ rows: any[]; row: any }> = [];
    return this.transactionChanges.run(changes, async () => {
      try {
        return await callback({ execute: (query) => this.execute(query) });
      } catch (error) {
        for (const { rows, row } of changes.reverse()) {
          const index = rows.indexOf(row);
          if (index !== -1) rows.splice(index, 1);
        }
        throw error;
      }
    });
  }

  override async execute(query: any): Promise<{ rows: Record<string, any>[] }> {
    const { text } = compileQuery(query);
    let barrierKey: string | undefined;
    if (text.startsWith("select id from company_accounts") && text.includes("regexp_replace")) {
      barrierKey = "cnpj";
    } else if (text.startsWith("select id from company_users") && text.includes("lower(email)")) {
      barrierKey = "email";
    }

    if (barrierKey) await this.waitForConcurrentPreflight(barrierKey);

    const collections = [this.companies, this.users, this.subscriptions, this.bulletins];
    const priorRows = collections.map((rows) => new Set(rows));
    const result = await super.execute(query);
    const changes = this.transactionChanges.getStore();
    if (changes) {
      collections.forEach((rows, index) => {
        for (const row of rows) {
          if (!priorRows[index].has(row)) changes.push({ rows, row });
        }
      });
    }
    return result;
  }

  private async waitForConcurrentPreflight(key: string): Promise<void> {
    let barrier = this.preflightBarriers.get(key);
    if (!barrier) {
      let release!: () => void;
      const promise = new Promise<void>((resolve) => { release = resolve; });
      barrier = { arrivals: 0, promise, release };
      this.preflightBarriers.set(key, barrier);
    }
    barrier.arrivals += 1;
    if (barrier.arrivals === 2) barrier.release();
    await barrier.promise;
  }
}

function createAuthApp(database: FakeDatabase) {
  const app = express();
  app.set("trust proxy", 1);
  app.use(express.json());
  app.use(session({
    secret: "test-only-session-secret",
    resave: false,
    saveUninitialized: false,
  }));
  app.use((req, _res, next) => {
    req.log = { warn: () => undefined } as never;
    next();
  });
  app.use(createAuthRouter(database as never));
  return app;
}

async function postJson(url: string, path: string, body: unknown, cookie?: string) {
  return fetch(`${url}${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(cookie ? { cookie } : {}),
    },
    body: JSON.stringify(body),
  });
}

function sessionCookie(response: Response): string {
  const setCookie = response.headers.getSetCookie()[0];
  assert(setCookie, "login response should set a session cookie");
  return setCookie.split(";")[0];
}

test("direct paid-company creation provisions CLIENTE_ADMIN and required password change", async () => {
  const database = new FakeDatabase();
  const server = await startServer(createCompaniesApp(database));
  try {
    const response = await postJson(server.url, "/companies", baseCompanyRequest);
    assert.equal(response.status, 201);
    const result = await response.json() as { temporaryPassword: string; userId: number };
    assert.equal(typeof result.temporaryPassword, "string");
    assert.ok(result.temporaryPassword.length >= 24);

    assert.equal(database.companies.length, 1);
    assert.equal(database.companies[0].cnpj, "12345678000190");
    assert.equal(database.users.length, 1);
    assert.equal(database.users[0].role, "CLIENTE_ADMIN");
    assert.equal(database.users[0].must_set_password, true);
    assert.equal(database.users[0].onboarding_completed, false);
    assert.equal(database.subscriptions.length, 1);
    assert.equal(database.bulletins.length, 1);
    assert.equal(database.users[0].id, result.userId);
  } finally {
    await server.close();
  }
});

test("lead approval creates the paid account and marks the inquiry active", async () => {
  const database = new FakeDatabase();
  database.seedInquiry(42, "Pendente");
  const server = await startServer(createCompaniesApp(database));
  try {
    const response = await postJson(server.url, "/companies", {
      ...baseCompanyRequest,
      inquiryId: 42,
      cnpj: "98.765.432/0001-10",
      adminEmail: "lead-admin@exemplo.test",
    });
    assert.equal(response.status, 201);
    const result = await response.json() as { temporaryPassword: string };
    assert.ok(result.temporaryPassword);
    assert.equal(database.inquiries.get(42)?.status, "Ativo");
    assert.equal(database.users[0].role, "CLIENTE_ADMIN");
    assert.equal(database.users[0].must_set_password, true);
    assert.equal(database.counts().companies, 1);
    assert.equal(database.counts().subscriptions, 1);
  } finally {
    await server.close();
  }
});

test("duplicate CNPJ or admin email returns conflict without partial records", async () => {
  const database = new FakeDatabase();
  const server = await startServer(createCompaniesApp(database));
  try {
    const first = await postJson(server.url, "/companies", baseCompanyRequest);
    assert.equal(first.status, 201);
    const originalCounts = database.counts();

    const duplicateCnpj = await postJson(server.url, "/companies", {
      ...baseCompanyRequest,
      adminEmail: "another-admin@exemplo.test",
    });
    assert.equal(duplicateCnpj.status, 409);
    assert.match((await duplicateCnpj.json() as { error: string }).error, /CNPJ/i);
    assert.deepEqual(database.counts(), originalCounts);

    const duplicateEmail = await postJson(server.url, "/companies", {
      ...baseCompanyRequest,
      cnpj: "11.111.111/0001-11",
    });
    assert.equal(duplicateEmail.status, 409);
    assert.match((await duplicateEmail.json() as { error: string }).error, /e-mail/i);
    assert.deepEqual(database.counts(), originalCounts);
  } finally {
    await server.close();
  }
});

test("simultaneous paid-company requests with the same CNPJ create only one complete account", async () => {
  const database = new ConcurrentPaidCompanyDatabase();
  const server = await startServer(createCompaniesApp(database));
  try {
    const responses = await Promise.all([
      postJson(server.url, "/companies", baseCompanyRequest),
      postJson(server.url, "/companies", {
        ...baseCompanyRequest,
        adminEmail: "another-admin@exemplo.test",
      }),
    ]);
    assert.deepEqual(responses.map((response) => response.status).sort(), [201, 409]);
    const conflict = responses.find((response) => response.status === 409)!;
    assert.match((await conflict.json() as { error: string }).error, /CNPJ/i);

    assert.deepEqual(database.counts(), {
      companies: 1,
      users: 1,
      subscriptions: 1,
      bulletins: 1,
    });
    assert.equal(database.companies[0].cnpj, "12345678000190");
    assert.equal(database.users[0].company_id, database.companies[0].id);
    assert.equal(database.subscriptions[0].company_id, database.companies[0].id);
    assert.equal(database.bulletins[0].company_id, database.companies[0].id);
  } finally {
    await server.close();
  }
});

test("simultaneous paid-company requests with the same admin email roll back the losing account", async () => {
  const database = new ConcurrentPaidCompanyDatabase();
  const server = await startServer(createCompaniesApp(database));
  try {
    const responses = await Promise.all([
      postJson(server.url, "/companies", baseCompanyRequest),
      postJson(server.url, "/companies", {
        ...baseCompanyRequest,
        cnpj: "11.111.111/0001-11",
      }),
    ]);
    assert.deepEqual(responses.map((response) => response.status).sort(), [201, 409]);
    const conflict = responses.find((response) => response.status === 409)!;
    assert.match((await conflict.json() as { error: string }).error, /e-mail/i);

    assert.deepEqual(database.counts(), {
      companies: 1,
      users: 1,
      subscriptions: 1,
      bulletins: 1,
    });
    assert.equal(database.users[0].email, "admin@exemplo.test");
    assert.equal(database.users[0].company_id, database.companies[0].id);
    assert.equal(database.subscriptions[0].company_id, database.companies[0].id);
    assert.equal(database.bulletins[0].company_id, database.companies[0].id);
  } finally {
    await server.close();
  }
});

test("completed lead cannot be approved twice or leave partial records", async () => {
  const database = new FakeDatabase();
  database.seedInquiry(43, "Ativo");
  const server = await startServer(createCompaniesApp(database));
  try {
    const response = await postJson(server.url, "/companies", {
      ...baseCompanyRequest,
      inquiryId: 43,
    });
    assert.equal(response.status, 409);
    assert.match((await response.json() as { error: string }).error, /concluída/i);
    assert.deepEqual(database.counts(), {
      companies: 0,
      users: 0,
      subscriptions: 0,
      bulletins: 0,
    });
    assert.equal(database.inquiries.get(43)?.status, "Ativo");
  } finally {
    await server.close();
  }
});

test("first login reports required password change and new password replaces temporary password", async () => {
  const database = new FakeDatabase();
  const created = await provisionPaidCompany({
    ...baseCompanyRequest,
    cnpj: "12345678000190",
    estado: "RJ",
    cidade: "Rio de Janeiro",
    razaoSocial: "Indústria Exemplo Ltda",
    nomeFantasia: "Indústria Exemplo",
    socioAdministrador: "Ana Administradora",
    telefone: null,
    renewalDate: "2027-01-01",
    nextBillingAmount: 890,
  }, database as never);

  const server = await startServer(createAuthApp(database));
  try {
    const login = await postJson(server.url, "/auth/login", {
      email: created.adminEmail,
      password: created.temporaryPassword,
    });
    assert.equal(login.status, 200);
    const loginUser = await login.json() as { role: string; mustSetPassword: boolean };
    assert.equal(loginUser.role, "CLIENTE_ADMIN");
    assert.equal(loginUser.mustSetPassword, true);
    const originalCookie = sessionCookie(login);
    const restored = await fetch(`${server.url}/auth/me`, { headers: { cookie: originalCookie } });
    assert.equal(restored.status, 200);
    const repeatLogin = await postJson(server.url, "/auth/login", {
      email: created.adminEmail, password: created.temporaryPassword,
    }, originalCookie);
    const cookie = sessionCookie(repeatLogin);
    assert.notEqual(cookie, originalCookie, "login must rotate the session");
    assert.equal((await fetch(`${server.url}/auth/me`, { headers: { cookie: originalCookie } })).status, 401);

    const setPassword = await postJson(server.url, "/auth/set-password", {
      password: "NewSecurePass123",
    }, cookie);
    assert.equal(setPassword.status, 200);
    assert.deepEqual(await setPassword.json(), { ok: true });

    const tempPasswordLogin = await postJson(server.url, "/auth/login", {
      email: created.adminEmail,
      password: created.temporaryPassword,
    });
    assert.equal(tempPasswordLogin.status, 401);

    const newPasswordLogin = await postJson(server.url, "/auth/login", {
      email: created.adminEmail,
      password: "NewSecurePass123",
    });
    assert.equal(newPasswordLogin.status, 200);
    const updatedUser = await newPasswordLogin.json() as { mustSetPassword: boolean };
    assert.equal(updatedUser.mustSetPassword, false);
    const activeCookie = sessionCookie(newPasswordLogin);
    const logout = await postJson(server.url, "/auth/logout", {}, activeCookie);
    assert.equal(logout.status, 200);
    assert.match(logout.headers.getSetCookie()[0], /Expires=Thu, 01 Jan 1970/);
    assert.equal((await fetch(`${server.url}/auth/me`, { headers: { cookie: activeCookie } })).status, 401);
  } finally {
    await server.close();
  }
});

test("login hides account existence and temporarily throttles repeated failures", async () => {
  const database = new FakeDatabase();
  const created = await provisionPaidCompany({
    ...baseCompanyRequest,
    cnpj: "12345678000190",
    estado: "RJ",
    cidade: "Rio de Janeiro",
    razaoSocial: "Indústria Exemplo Ltda",
    nomeFantasia: "Indústria Exemplo",
    socioAdministrador: "Ana Administradora",
    telefone: null,
    renewalDate: "2027-01-01",
    nextBillingAmount: 890,
  }, database as never);
  const server = await startServer(createAuthApp(database));
  try {
    const missingAccount = await postJson(server.url, "/auth/login", {
      email: "unknown@exemplo.test",
      password: "incorrect",
    });
    const existingAccountWrongPassword = await postJson(server.url, "/auth/login", {
      email: created.adminEmail,
      password: "incorrect",
    });
    assert.equal(missingAccount.status, 401);
    assert.equal(existingAccountWrongPassword.status, 401);
    assert.deepEqual(await missingAccount.json(), await existingAccountWrongPassword.json());

    let lastFailure: Response | undefined;
    for (let attempt = 1; attempt < 5; attempt += 1) {
      lastFailure = await postJson(server.url, "/auth/login", {
        email: "unknown@exemplo.test",
        password: "incorrect",
      });
    }
    assert.equal(lastFailure?.status, 429);
    assert.ok(Number(lastFailure?.headers.get("retry-after")) > 0);

    const validLogin = await postJson(server.url, "/auth/login", {
      email: created.adminEmail,
      password: created.temporaryPassword,
    });
    assert.equal(validLogin.status, 200);
  } finally {
    await server.close();
  }
});

test("login throttles varied emails by forwarded client IP without leaking account information", async () => {
  assert.equal(productionApp.get("trust proxy"), 1);

  const database = new FakeDatabase();
  const server = await startServer(createAuthApp(database));
  const loginFromIp = (ip: string, email: string) =>
    fetch(`${server.url}/auth/login`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-forwarded-for": ip,
      },
      body: JSON.stringify({ email, password: "incorrect" }),
    });

  try {
    const failedBodies: unknown[] = [];
    for (let attempt = 1; attempt <= 19; attempt += 1) {
      const response = await loginFromIp(
        "198.51.100.17",
        `unknown-${attempt}@exemplo.test`,
      );
      assert.equal(response.status, 401);
      failedBodies.push(await response.json());
    }
    assert.ok(failedBodies.every((body) => JSON.stringify(body) === JSON.stringify(failedBodies[0])));
    assert.deepEqual(failedBodies[0], { error: "Credenciais inválidas" });

    const limitReached = await loginFromIp("198.51.100.17", "another-user@exemplo.test");
    assert.equal(limitReached.status, 429);
    assert.ok(Number(limitReached.headers.get("retry-after")) > 0);
    assert.deepEqual(await limitReached.json(), {
      error: "Muitas tentativas. Tente novamente mais tarde.",
    });

    const separateClient = await loginFromIp("198.51.100.18", "fresh-user@exemplo.test");
    assert.equal(separateClient.status, 401);
    assert.deepEqual(await separateClient.json(), failedBodies[0]);
  } finally {
    await server.close();
  }
});

test("login limits concurrent guesses before their password checks finish", async () => {
  const database = new FakeDatabase();
  const server = await startServer(createAuthApp(database));
  try {
    const responses = await Promise.all(
      Array.from({ length: 12 }, () => postJson(server.url, "/auth/login", {
        email: "parallel-guess@exemplo.test",
        password: "incorrect",
      })),
    );
    const statuses = responses.map((response) => response.status);
    assert.ok(statuses.filter((status) => status === 429).length >= 1);
    assert.ok(statuses.every((status) => status === 401 || status === 429));
  } finally {
    await server.close();
  }
});

test("valid admin recovery remains available after invalid recovery attempts", async () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalRecoveryToken = process.env.ADMIN_RECOVERY_TOKEN;
  const recoveryToken = "test-only-admin-recovery-token-with-more-than-32-bytes";
  process.env.NODE_ENV = "production";
  process.env.ADMIN_RECOVERY_TOKEN = recoveryToken;

  let recoveryQuery = 0;
  let nextAuditId = 1;
  const auditResults = new Map<number, string>();
  const failureLimits = new Map<string, Record<string, any>>();
  const database = {
    execute: async (query: any) => {
      const limiterQuery = executeFakeFailureLimiterQuery(query, failureLimits);
      if (limiterQuery.handled) return limiterQuery.result;
      const { text, params } = compileQuery(query);
      if (text.startsWith("insert into admin_recovery_audit")) {
        const id = nextAuditId++;
        auditResults.set(id, "in_progress");
        return { rows: [{ id }] };
      }
      if (text.startsWith("update admin_recovery_audit")) {
        const id = Number(params[1]);
        auditResults.set(id, String(params[0]));
        return { rows: [{ id }] };
      }
      return { rows: [] };
    },
    transaction: async (callback: (tx: { execute: (query: any) => Promise<{ rows: unknown[] }> }) => Promise<unknown>) =>
      callback({
        execute: async (query: any) => {
          const limiterQuery = executeFakeFailureLimiterQuery(query, failureLimits);
          if (limiterQuery.handled) return limiterQuery.result;
          const { text, params } = compileQuery(query);
          if (text.startsWith("select id from admin_recovery_audit")) {
            return { rows: [{ id: Number(params[0]) }] };
          }
          if (text.startsWith("update admin_recovery_audit")) {
            const id = Number(params[0]);
            auditResults.set(id, "success");
            return { rows: [{ id }] };
          }
          recoveryQuery += 1;
          if (recoveryQuery === 1) return { rows: [{ id: 1, ativo: true }] };
          if (recoveryQuery === 2) return { rows: [{ id: 1 }] };
          return { rows: [] };
        },
      }),
  };
  const app = express();
  app.set("trust proxy", 1);
  app.use(express.json());
  app.use(session({
    secret: "test-only-session-secret",
    resave: false,
    saveUninitialized: false,
  }));
  app.use((req, _res, next) => {
    req.log = { warn: () => undefined, error: () => undefined } as never;
    next();
  });
  app.use(createAuthRouter(database as never));
  const server = await startServer(app);

  try {
    for (let attempt = 0; attempt < 6; attempt += 1) {
      const invalid = await fetch(`${server.url}/auth/admin/recover`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-forwarded-proto": "https",
          "x-forwarded-for": "198.51.100.25",
          authorization: "Bearer invalid-token",
        },
        body: "{}",
      });
      assert.equal(invalid.status, 404);
      assert.deepEqual(await invalid.json(), {
        error: "Recuperação indisponível ou credencial inválida",
      });
    }

    const authorized = await fetch(`${server.url}/auth/admin/recover`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-forwarded-proto": "https",
        "x-forwarded-for": "198.51.100.25",
        authorization: `Bearer ${recoveryToken}`,
      },
      body: "{}",
    });
    assert.equal(authorized.status, 200);
    const result = await authorized.json() as { temporaryPassword: string };
    assert.ok(result.temporaryPassword.length >= 24);
    assert.deepEqual([...auditResults.values()], [
      "invalid_credential",
      "invalid_credential",
      "invalid_credential",
      "invalid_credential",
      "invalid_credential",
      "rate_limited",
      "success",
    ]);
  } finally {
    await server.close();
    if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = originalNodeEnv;
    if (originalRecoveryToken === undefined) delete process.env.ADMIN_RECOVERY_TOKEN;
    else process.env.ADMIN_RECOVERY_TOKEN = originalRecoveryToken;
  }
});

test("admin can reissue a one-time password and the old password stops working", async () => {
  const database = new FakeDatabase();
  const created = await provisionPaidCompany({
    ...baseCompanyRequest,
    cnpj: "12345678000190",
    estado: "RJ",
    cidade: "Rio de Janeiro",
    razaoSocial: "Indústria Exemplo Ltda",
    nomeFantasia: "Indústria Exemplo",
    socioAdministrador: "Ana Administradora",
    telefone: null,
    renewalDate: "2027-01-01",
    nextBillingAmount: 890,
  }, database as never);
  const oldPasswordHash = database.users[0].password_hash;

  const adminServer = await startServer(createCompaniesApp(database));
  const authServer = await startServer(createAuthApp(database));
  try {
    const reissue = await postJson(
      adminServer.url,
      `/companies/${created.companyId}/temporary-password`,
      { adminUserId: database.users[0].id },
    );
    assert.equal(reissue.status, 200);
    assert.equal(reissue.headers.get("cache-control"), "no-store, private");
    const credential = await reissue.json() as {
      userId: number;
      adminEmail: string;
      temporaryPassword: string;
    };

    assert.equal(credential.userId, database.users[0].id);
    assert.equal(credential.adminEmail, created.adminEmail);
    assert.ok(credential.temporaryPassword.length >= 24);
    assert.notEqual(database.users[0].password_hash, oldPasswordHash);
    assert.notEqual(database.users[0].password_hash, credential.temporaryPassword);
    assert.equal(database.users[0].must_set_password, true);
    assert.equal(database.users[0].onboarding_completed, false);

    const oldLogin = await postJson(authServer.url, "/auth/login", {
      email: created.adminEmail,
      password: created.temporaryPassword,
    });
    assert.equal(oldLogin.status, 401);

    const newLogin = await postJson(authServer.url, "/auth/login", {
      email: created.adminEmail,
      password: credential.temporaryPassword,
    });
    assert.equal(newLogin.status, 200);
    const loginUser = await newLogin.json() as { mustSetPassword: boolean };
    assert.equal(loginUser.mustSetPassword, true);
  } finally {
    await adminServer.close();
    await authServer.close();
  }
});

test("admin can choose a company administrator and cannot target another company's user", async () => {
  const database = new FakeDatabase();
  const created = await provisionPaidCompany({
    ...baseCompanyRequest,
    cnpj: "12345678000190",
    estado: "RJ",
    cidade: "Rio de Janeiro",
    razaoSocial: "Indústria Exemplo Ltda",
    nomeFantasia: "Indústria Exemplo",
    socioAdministrador: "Ana Administradora",
    telefone: null,
    renewalDate: "2027-01-01",
    nextBillingAmount: 890,
  }, database as never);
  const firstAdmin = database.users[0];
  const firstAdminPasswordHash = firstAdmin.password_hash;
  const secondAdmin = {
    ...firstAdmin,
    id: 2,
    nome: "Bruno Administrador",
    email: "bruno@exemplo.test",
    password_hash: "existing-password-hash",
    must_set_password: false,
  };
  const otherCompanyAdmin = {
    ...firstAdmin,
    id: 3,
    company_id: created.companyId + 1,
    email: "outro@empresa.test",
    password_hash: "other-company-password-hash",
  };
  database.users.push(secondAdmin, otherCompanyAdmin);

  const adminServer = await startServer(createCompaniesApp(database));
  try {
    const selectedResponse = await postJson(
      adminServer.url,
      `/companies/${created.companyId}/temporary-password`,
      { adminUserId: secondAdmin.id },
    );
    assert.equal(selectedResponse.status, 200);
    const credential = await selectedResponse.json() as {
      companyId: number;
      userId: number;
      adminEmail: string;
      temporaryPassword: string;
    };
    assert.equal(credential.companyId, created.companyId);
    assert.equal(credential.userId, secondAdmin.id);
    assert.equal(credential.adminEmail, secondAdmin.email);
    assert.equal(firstAdmin.password_hash, firstAdminPasswordHash);
    assert.equal(firstAdmin.must_set_password, true);
    assert.notEqual(secondAdmin.password_hash, "existing-password-hash");
    assert.equal(secondAdmin.must_set_password, true);
    assert.equal(otherCompanyAdmin.password_hash, "other-company-password-hash");

    const wrongCompanyResponse = await postJson(
      adminServer.url,
      `/companies/${created.companyId}/temporary-password`,
      { adminUserId: otherCompanyAdmin.id },
    );
    assert.equal(wrongCompanyResponse.status, 404);
    assert.equal(otherCompanyAdmin.password_hash, "other-company-password-hash");

    const missingSelectionResponse = await postJson(
      adminServer.url,
      `/companies/${created.companyId}/temporary-password`,
      {},
    );
    assert.equal(missingSelectionResponse.status, 400);
  } finally {
    await adminServer.close();
  }
});

test("simultaneous reissues return the one-time password that remains active", async () => {
  const database = new FakeDatabase();
  const created = await provisionPaidCompany({
    ...baseCompanyRequest,
    cnpj: "12345678000190",
    estado: "RJ",
    cidade: "Rio de Janeiro",
    razaoSocial: "Indústria Exemplo Ltda",
    nomeFantasia: "Indústria Exemplo",
    socioAdministrador: "Ana Administradora",
    telefone: null,
    renewalDate: "2027-01-01",
    nextBillingAmount: 890,
  }, database as never);

  const adminServer = await startServer(createCompaniesApp(database));
  const authServer = await startServer(createAuthApp(database));
  try {
    const responses = await Promise.all([
      postJson(adminServer.url, `/companies/${created.companyId}/temporary-password`, {
        adminUserId: database.users[0].id,
      }),
      postJson(adminServer.url, `/companies/${created.companyId}/temporary-password`, {
        adminUserId: database.users[0].id,
      }),
    ]);
    assert.deepEqual(responses.map((response) => response.status), [200, 200]);
    const credentials = await Promise.all(responses.map((response) => response.json())) as Array<{
      userId: number;
      adminEmail: string;
      temporaryPassword: string;
    }>;

    assert.equal(credentials[0].userId, database.users[0].id);
    assert.equal(credentials[1].userId, database.users[0].id);
    assert.equal(credentials[0].adminEmail, created.adminEmail);
    assert.equal(credentials[1].adminEmail, created.adminEmail);
    assert.equal(credentials[0].temporaryPassword, credentials[1].temporaryPassword);
    assert.equal(database.users[0].must_set_password, true);
    assert.equal(database.users[0].onboarding_completed, false);

    const login = await postJson(authServer.url, "/auth/login", {
      email: created.adminEmail,
      password: credentials[0].temporaryPassword,
    });
    assert.equal(login.status, 200);
  } finally {
    await adminServer.close();
    await authServer.close();
  }
});

test("a concurrent reissue from another process cannot replace the issued password", async () => {
  const database = new FakeDatabase();
  const created = await provisionPaidCompany({
    ...baseCompanyRequest,
    cnpj: "12345678000190",
    estado: "RJ",
    cidade: "Rio de Janeiro",
    razaoSocial: "Indústria Exemplo Ltda",
    nomeFantasia: "Indústria Exemplo",
    socioAdministrador: "Ana Administradora",
    telefone: null,
    renewalDate: "2027-01-01",
    nextBillingAmount: 890,
  }, database as never);

  const lockState = { locked: false };
  const firstServer = await startServer(createCompaniesApp(
    database,
    createReissueConnection(database, lockState),
  ));
  const secondServer = await startServer(createCompaniesApp(
    database,
    createReissueConnection(database, lockState),
  ));
  const authServer = await startServer(createAuthApp(database));
  try {
    const responses = await Promise.all([
      postJson(firstServer.url, `/companies/${created.companyId}/temporary-password`, {
        adminUserId: database.users[0].id,
      }),
      postJson(secondServer.url, `/companies/${created.companyId}/temporary-password`, {
        adminUserId: database.users[0].id,
      }),
    ]);
    assert.deepEqual(responses.map((response) => response.status).sort(), [200, 409]);
    const issuedResponse = responses.find((response) => response.status === 200)!;
    const credential = await issuedResponse.json() as { temporaryPassword: string };

    const login = await postJson(authServer.url, "/auth/login", {
      email: created.adminEmail,
      password: credential.temporaryPassword,
    });
    assert.equal(login.status, 200);
  } finally {
    await firstServer.close();
    await secondServer.close();
    await authServer.close();
  }
});
