import assert from "node:assert/strict";
import { once } from "node:events";
import express from "express";
import session from "express-session";
import { test } from "node:test";
import { createAuthRouter } from "../src/routes/auth";
import { executeFakeFailureLimiterQuery } from "./fake-failure-limiter";

type AuditRow = { id: number; attempted_at: string; result: string };

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

test("administrative recovery attempts are persisted without secrets and history is admin-only", async () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalRecoveryToken = process.env.ADMIN_RECOVERY_TOKEN;
  const configuredToken = "a-test-recovery-token-long-enough-for-production";
  process.env.NODE_ENV = "production";
  process.env.ADMIN_RECOVERY_TOKEN = configuredToken;

  const audit: AuditRow[] = [];
  let nextAuditId = 1;
  let adminAvailable = true;
  let failRecovery = false;
  const failureLimits = new Map<string, Record<string, any>>();

  const updateAudit = (id: number, result: string): AuditRow | undefined => {
    const row = audit.find((attempt) => attempt.id === id);
    if (row?.result === "in_progress") row.result = result;
    return row;
  };

  const database = {
    execute: async (query: any) => {
      const limiterQuery = executeFakeFailureLimiterQuery(query, failureLimits);
      if (limiterQuery.handled) return limiterQuery.result;
      const { text, params } = compileQuery(query);
      if (text.startsWith("insert into admin_recovery_audit")) {
        const row = {
          id: nextAuditId++,
          attempted_at: new Date().toISOString(),
          result: "in_progress",
        };
        audit.push(row);
        return { rows: [{ id: row.id }] };
      }
      if (text.startsWith("update admin_recovery_audit")) {
        const row = updateAudit(Number(params[1]), String(params[0]));
        return { rows: row?.result === String(params[0]) ? [{ id: row.id }] : [] };
      }
      if (text.startsWith("with stale_attempts as")) {
        const staleBefore = Date.now() - Number(params[0]);
        const interrupted = audit.filter((row) =>
          row.result === "in_progress" && Date.parse(row.attempted_at) < staleBefore,
        );
        for (const row of interrupted) row.result = "interrupted";
        return { rows: interrupted.map(({ id }) => ({ id })) };
      }
      if (text.startsWith("select count(*)::int as total from admin_recovery_audit")) {
        return { rows: [{ total: audit.length }] };
      }
      if (text.startsWith("select id, attempted_at as")) {
        const limit = Number(params[0]);
        const offset = Number(params[1]);
        return {
          rows: [...audit]
            .sort((a, b) =>
              Date.parse(b.attempted_at) - Date.parse(a.attempted_at) || b.id - a.id,
            )
            .slice(offset, offset + limit)
            .map(({ id, attempted_at, result }) => ({ id, attemptedAt: attempted_at, result })),
        };
      }
      return { rows: [] };
    },
    transaction: async (callback: (tx: { execute: (query: any) => Promise<{ rows: any[] }> }) => Promise<unknown>) =>
      callback({
        execute: async (query: any) => {
          const limiterQuery = executeFakeFailureLimiterQuery(query, failureLimits);
          if (limiterQuery.handled) return limiterQuery.result;
          const { text, params } = compileQuery(query);
          if (text.startsWith("select id from admin_recovery_audit")) {
            const row = audit.find((attempt) =>
              attempt.id === Number(params[0]) && attempt.result === "in_progress",
            );
            return { rows: row ? [{ id: row.id }] : [] };
          }
          if (text.includes("from company_users cu") && text.includes("join company_accounts ca")) {
            return { rows: adminAvailable ? [{ id: 1, ativo: true }] : [] };
          }
          if (text.startsWith("update company_users set password_hash")) {
            if (failRecovery) throw new Error("simulated recovery failure");
            return { rows: [{ id: 1 }] };
          }
          if (text.startsWith("update admin_recovery_audit")) {
            const row = updateAudit(Number(params[0]), "success");
            return { rows: row ? [{ id: row.id }] : [] };
          }
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
    const role = req.get("x-test-role");
    if (role === "ADMIN_PETRON" || role === "CLIENTE_ADMIN") {
      req.session.user = {
        id: 1,
        email: "operador@petron.test",
        nome: "Operador",
        role,
        companyId: 1,
        companyName: "Petron Radar",
      };
    }
    req.log = { warn: () => undefined, error: () => undefined } as never;
    next();
  });
  app.use(createAuthRouter(database as never));
  app.use((
    _error: Error,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction,
  ) => {
    res.status(500).json({ error: "Erro interno" });
  });
  const server = await startServer(app);

  try {
    for (let attempt = 0; attempt < 6; attempt += 1) {
      const invalid = await fetch(`${server.url}/auth/admin/recover`, {
        method: "POST",
        headers: {
          "x-forwarded-proto": "https",
          "x-forwarded-for": "198.51.100.25",
          authorization: "Bearer invalid-token",
        },
      });
      assert.equal(invalid.status, 404);
    }

    const recovery = await fetch(`${server.url}/auth/admin/recover`, {
      method: "POST",
      headers: {
        "x-forwarded-proto": "https",
        "x-forwarded-for": "198.51.100.25",
        authorization: `Bearer ${configuredToken}`,
      },
    });
    assert.equal(recovery.status, 200);
    const { temporaryPassword } = await recovery.json() as { temporaryPassword: string };
    assert.ok(temporaryPassword.length >= 24);

    adminAvailable = false;
    const unavailable = await fetch(`${server.url}/auth/admin/recover`, {
      method: "POST",
      headers: {
        "x-forwarded-proto": "https",
        "x-forwarded-for": "198.51.100.26",
        authorization: `Bearer ${configuredToken}`,
      },
    });
    assert.equal(unavailable.status, 409);

    adminAvailable = true;
    failRecovery = true;
    const failed = await fetch(`${server.url}/auth/admin/recover`, {
      method: "POST",
      headers: {
        "x-forwarded-proto": "https",
        "x-forwarded-for": "198.51.100.27",
        authorization: `Bearer ${configuredToken}`,
      },
    });
    assert.equal(failed.status, 500);
    assert.ok(!(await failed.text()).includes(temporaryPassword));

    assert.deepEqual(audit.map(({ result }) => result), [
      "invalid_credential",
      "invalid_credential",
      "invalid_credential",
      "invalid_credential",
      "invalid_credential",
      "rate_limited",
      "success",
      "unavailable",
      "error",
    ]);
    assert.ok(audit.every(({ attempted_at }) => Number.isFinite(Date.parse(attempted_at))));
    assert.ok(audit.every((row) =>
      Object.keys(row).every((key) => !/token|password|secret/i.test(key)),
    ));
    audit.push(
      {
        id: nextAuditId++,
        attempted_at: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
        result: "in_progress",
      },
      {
        id: nextAuditId++,
        attempted_at: new Date().toISOString(),
        result: "in_progress",
      },
    );

    const unauthenticated = await fetch(`${server.url}/auth/admin/recovery-history`);
    assert.equal(unauthenticated.status, 401);

    const client = await fetch(`${server.url}/auth/admin/recovery-history`, {
      headers: { "x-test-role": "CLIENTE_ADMIN" },
    });
    assert.equal(client.status, 403);

    const admin = await fetch(`${server.url}/auth/admin/recovery-history`, {
      headers: { "x-test-role": "ADMIN_PETRON" },
    });
    assert.equal(admin.status, 200);
    const history = await admin.json() as {
      attempts: (AuditRow & { attemptedAt: string })[];
      page: number;
      pageSize: number;
      total: number;
      totalPages: number;
    };
    assert.deepEqual(history.attempts.map(({ result }) => result), [
      "in_progress",
      "error",
      "unavailable",
      "success",
      "rate_limited",
      "invalid_credential",
      "invalid_credential",
      "invalid_credential",
      "invalid_credential",
      "invalid_credential",
      "interrupted",
    ]);
    assert.equal(history.page, 1);
    assert.equal(history.pageSize, 20);
    assert.equal(history.total, 11);
    assert.equal(history.totalPages, 1);
    assert.ok(history.attempts.every((attempt) =>
      Object.keys(attempt).sort().join(",") === "attemptedAt,id,result",
    ));
    assert.ok(!JSON.stringify(history).includes(configuredToken));
    assert.ok(!JSON.stringify(history).includes(temporaryPassword));

    const invalidPage = await fetch(
      `${server.url}/auth/admin/recovery-history?page=0`,
      { headers: { "x-test-role": "ADMIN_PETRON" } },
    );
    assert.equal(invalidPage.status, 400);

    const olderTimestamp = "2000-01-01T00:00:00.000Z";
    for (let index = 0; index < 105; index += 1) {
      audit.push({
        id: nextAuditId++,
        attempted_at: olderTimestamp,
        result: index % 2 === 0 ? "invalid_credential" : "rate_limited",
      });
    }

    const firstPageResponse = await fetch(
      `${server.url}/auth/admin/recovery-history?page=1&pageSize=100`,
      { headers: { "x-test-role": "ADMIN_PETRON" } },
    );
    assert.equal(firstPageResponse.status, 200);
    const firstPage = await firstPageResponse.json() as typeof history;
    assert.equal(firstPage.pageSize, 100);
    assert.equal(firstPage.total, 116);
    assert.equal(firstPage.totalPages, 2);
    assert.equal(firstPage.attempts.length, 100);
    assert.deepEqual(firstPage.attempts.slice(0, 11).map(({ result }) => result), history.attempts.map(({ result }) => result));
    assert.deepEqual(
      firstPage.attempts.slice(11).map(({ id }) => id),
      Array.from({ length: 89 }, (_, index) => 116 - index),
    );

    const secondPageResponse = await fetch(
      `${server.url}/auth/admin/recovery-history?page=2&pageSize=100`,
      { headers: { "x-test-role": "ADMIN_PETRON" } },
    );
    assert.equal(secondPageResponse.status, 200);
    const secondPage = await secondPageResponse.json() as typeof history;
    assert.equal(secondPage.attempts.length, 16);
    assert.deepEqual(
      secondPage.attempts.map(({ id }) => id),
      Array.from({ length: 16 }, (_, index) => 27 - index),
    );
    assert.equal(new Set([...firstPage.attempts, ...secondPage.attempts].map(({ id }) => id)).size, 116);
    assert.ok([...firstPage.attempts, ...secondPage.attempts].every((attempt) =>
      Object.keys(attempt).sort().join(",") === "attemptedAt,id,result",
    ));
    assert.ok(!JSON.stringify([firstPage, secondPage]).includes(configuredToken));
    assert.ok(!JSON.stringify([firstPage, secondPage]).includes(temporaryPassword));
  } finally {
    await server.close();
    if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = originalNodeEnv;
    if (originalRecoveryToken === undefined) delete process.env.ADMIN_RECOVERY_TOKEN;
    else process.env.ADMIN_RECOVERY_TOKEN = originalRecoveryToken;
  }
});
