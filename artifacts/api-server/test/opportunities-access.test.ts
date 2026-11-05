import assert from "node:assert/strict";
import { once } from "node:events";
import express from "express";
import session from "express-session";
import { test } from "node:test";
import { createOpportunitiesRouter } from "../src/routes/opportunities";
import { createPortfolioRouter } from "../src/routes/portfolio";

type Row = Record<string, any>;

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

function createTestDatabase() {
  const calls: string[] = [];
  const now = new Date("2026-11-05T12:00:00.000Z");
  const opportunities: Row[] = [{
    id: 1,
    title: "Serviço de manutenção",
    sector: "Energia",
    company: "Empresa pública",
    value: 120000,
    status: "ativa",
    region: "Sudeste",
    description: "Descrição pública",
    deadline: null,
    petronectId: "PN-001",
    createdAt: now,
    privatePortfolio: [{ companyId: 2, notes: "privado" }],
    analysis: { score: 99 },
    documents: [{ label: "anexo confidencial" }],
  }];
  const portfolio: Row[] = [
    { id: 10, company_id: 101, opportunity_id: 1, stage: "avaliando", notes: "empresa 101" },
    { id: 20, company_id: 202, opportunity_id: 1, stage: "orcando", notes: "empresa 202" },
  ];

  return {
    calls,
    opportunities,
    portfolio,
    database: {
      execute: async (query: any) => {
        const { text, params } = compileQuery(query);
        calls.push(text);

        if (text.startsWith("select id, title, sector, company, value")) {
          if (text.includes("where id =")) {
            return { rows: opportunities.filter((row) => row.id === Number(params[0])) };
          }
          return { rows: [...opportunities] };
        }
        if (text.startsWith("insert into opportunities")) {
          const [title, sector, company, value, status, region, description, deadline, petronectId] = params;
          const row = {
            id: opportunities.length + 1,
            title, sector, company, value, status, region, description, deadline, petronectId,
            createdAt: now,
          };
          opportunities.push(row);
          return { rows: [row] };
        }
        if (text.includes("from opportunity_portfolio p")) {
          const companyId = Number(params[0]);
          return { rows: portfolio.filter((row) => row.company_id === companyId) };
        }
        if (text.startsWith("select id from opportunities")) {
          return { rows: opportunities.some((row) => row.id === Number(params[0])) ? [{ id: Number(params[0]) }] : [] };
        }
        if (text.startsWith("insert into opportunity_portfolio")) {
          const [companyId, opportunityId] = params;
          const row = {
            id: Math.max(0, ...portfolio.map((item) => item.id)) + 1,
            company_id: Number(companyId),
            opportunity_id: Number(opportunityId),
            stage: "avaliando",
            notes: null,
          };
          portfolio.push(row);
          return { rows: [row] };
        }
        if (text.startsWith("update opportunity_portfolio set")) {
          const [stage, notes, id, companyId] = params;
          const row = portfolio.find((item) => item.id === Number(id) && item.company_id === Number(companyId));
          if (row) {
            row.stage = stage ?? row.stage;
            row.notes = notes ?? row.notes;
          }
          return { rows: [] };
        }
        if (text.startsWith("delete from opportunity_portfolio")) {
          const [id, companyId] = params;
          const index = portfolio.findIndex((item) => item.id === Number(id) && item.company_id === Number(companyId));
          if (index >= 0) portfolio.splice(index, 1);
          return { rows: [] };
        }
        throw new Error(`Unhandled opportunities test query: ${text}`);
      },
    },
  };
}

async function startApp() {
  const testDb = createTestDatabase();
  const app = express();
  app.use(express.json());
  app.use(session({
    secret: "opportunities-access-test-secret",
    resave: false,
    saveUninitialized: false,
  }));
  app.post("/test-login/:role/:companyId", (req, res) => {
    req.session.user = {
      id: 1,
      email: "tester@example.test",
      nome: "Tester",
      role: req.params.role as "ADMIN_PETRON" | "CLIENTE_ADMIN" | "USUARIO_CLIENTE",
      companyId: Number(req.params.companyId),
      companyName: "Test company",
    };
    res.sendStatus(204);
  });
  app.use(createOpportunitiesRouter(testDb.database as never));
  app.use(createPortfolioRouter(testDb.database as never));

  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  assert(address && typeof address !== "string");

  return {
    ...testDb,
    url: `http://127.0.0.1:${address.port}`,
    close: () => new Promise<void>((resolve, reject) =>
      server.close((error) => error ? reject(error) : resolve()),
    ),
  };
}

async function login(url: string, role: string, companyId: number): Promise<string> {
  const response = await fetch(`${url}/test-login/${role}/${companyId}`, { method: "POST" });
  assert.equal(response.status, 204);
  const cookie = response.headers.get("set-cookie");
  assert(cookie, "test login must establish a session cookie");
  return cookie.split(";")[0];
}

test("opportunity list, detail, and create require explicit authentication and authorization", async () => {
  const app = await startApp();
  try {
    for (const request of [
      () => fetch(`${app.url}/opportunities`),
      () => fetch(`${app.url}/opportunities/1`),
      () => fetch(`${app.url}/opportunities`, { method: "POST", headers: { "content-type": "application/json" }, body: "{}" }),
    ]) {
      assert.equal((await request()).status, 401);
    }
    assert.equal(app.calls.length, 0, "unauthenticated requests must be rejected before database access");

    const clientCookie = await login(app.url, "CLIENTE_ADMIN", 101);
    assert.equal((await fetch(`${app.url}/opportunities`, { headers: { cookie: clientCookie } })).status, 200);
    assert.equal((await fetch(`${app.url}/opportunities/1`, { headers: { cookie: clientCookie } })).status, 200);

    const clientCreate = await fetch(`${app.url}/opportunities`, {
      method: "POST",
      headers: { cookie: clientCookie, "content-type": "application/json" },
      body: JSON.stringify({
        title: "Tentativa de inclusão",
        sector: "Energia",
        company: "Empresa pública",
        value: 1,
        status: "ativa",
        region: "Sudeste",
      }),
    });
    assert.equal(clientCreate.status, 403, "client accounts cannot edit the shared catalog");

    const adminCookie = await login(app.url, "ADMIN_PETRON", 999);
    const adminCreate = await fetch(`${app.url}/opportunities`, {
      method: "POST",
      headers: { cookie: adminCookie, "content-type": "application/json" },
      body: JSON.stringify({
        title: "Oportunidade administrada",
        sector: "Energia",
        company: "Empresa pública",
        value: 500,
        status: "ativa",
        region: "Sul",
      }),
    });
    assert.equal(adminCreate.status, 201);
    assert.equal((await adminCreate.json() as Row).title, "Oportunidade administrada");
  } finally {
    await app.close();
  }
});

test("shared catalog responses exclude company portfolio, analyses, and documents", async () => {
  const app = await startApp();
  try {
    const cookie = await login(app.url, "CLIENTE_ADMIN", 101);
    const listResponse = await fetch(`${app.url}/opportunities`, { headers: { cookie } });
    const detailResponse = await fetch(`${app.url}/opportunities/1`, { headers: { cookie } });
    assert.equal(listResponse.status, 200);
    assert.equal(detailResponse.status, 200);

    const listed = (await listResponse.json() as Row[])[0];
    const detailed = await detailResponse.json() as Row;
    for (const opportunity of [listed, detailed]) {
      assert.equal(opportunity.title, "Serviço de manutenção");
      assert.equal("privatePortfolio" in opportunity, false);
      assert.equal("analysis" in opportunity, false);
      assert.equal("documents" in opportunity, false);
    }
    assert.ok(app.calls.some((query) =>
      query.includes("select id, title, sector, company, value, status, region, description, deadline, petronect_id as"),
    ), "catalog SQL must select a fixed public-field projection");
  } finally {
    await app.close();
  }
});

test("portfolio reads and writes stay scoped to the company in the session", async () => {
  const app = await startApp();
  try {
    const companyCookie = await login(app.url, "CLIENTE_ADMIN", 101);
    const response = await fetch(`${app.url}/portfolio?companyId=202`, { headers: { cookie: companyCookie } });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), [
      { id: 10, company_id: 101, opportunity_id: 1, stage: "avaliando", notes: "empresa 101" },
    ]);

    const attemptedCreate = await fetch(`${app.url}/portfolio`, {
      method: "POST",
      headers: { cookie: companyCookie, "content-type": "application/json" },
      body: JSON.stringify({ opportunityId: 1, companyId: 202 }),
    });
    assert.equal(attemptedCreate.status, 201);
    assert.equal(app.portfolio.at(-1)?.company_id, 101, "request data cannot choose another portfolio owner");

    const attemptedUpdate = await fetch(`${app.url}/portfolio/20`, {
      method: "PATCH",
      headers: { cookie: companyCookie, "content-type": "application/json" },
      body: JSON.stringify({ stage: "enviada", notes: "acesso cruzado" }),
    });
    assert.equal(attemptedUpdate.status, 200);
    assert.equal(app.portfolio.find((row) => row.id === 20)?.stage, "orcando");
    assert.equal(app.portfolio.find((row) => row.id === 20)?.notes, "empresa 202");

    const attemptedDelete = await fetch(`${app.url}/portfolio/20`, {
      method: "DELETE",
      headers: { cookie: companyCookie },
    });
    assert.equal(attemptedDelete.status, 200);
    assert.ok(app.portfolio.some((row) => row.id === 20), "another company's portfolio row must remain intact");

    await fetch(`${app.url}/portfolio`, { headers: { cookie: companyCookie } });
    assert.ok(app.calls.filter((query) => query.includes("from opportunity_portfolio p")).every((query) =>
      query.includes("where p.company_id = $1"),
    ));
  } finally {
    await app.close();
  }
});
