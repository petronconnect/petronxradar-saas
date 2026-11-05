import assert from "node:assert/strict";
import { once } from "node:events";
import express from "express";
import session from "express-session";
import { test } from "node:test";
import { createOpportunityDocumentsRouter } from "../src/routes/opportunity-documents";

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
  const opportunities = new Set([1, 2]);
  const documents: Row[] = [];
  const reviews = new Map<number, Row>();
  const users = new Map([[7, "Petron Admin"]]);
  let nextDocId = 1;
  const now = new Date("2026-11-05T12:00:00.000Z");

  return {
    documents,
    reviews,
    database: {
      execute: async (query: any) => {
        const { text, params } = compileQuery(query);

        if (text.startsWith("select id from opportunities")) {
          return { rows: opportunities.has(Number(params[0])) ? [{ id: Number(params[0]) }] : [] };
        }
        if (text.startsWith('select d.id, d.opportunity_id as "opportunityid"')) {
          const opportunityId = Number(params[0]);
          return {
            rows: documents
              .filter((doc) => doc.opportunity_id === opportunityId)
              .map((doc) => ({
                ...doc,
                linkTestedByName: doc.link_tested_by ? users.get(doc.link_tested_by) : null,
              })),
          };
        }
        if (text.startsWith('select r.status, r.verified_at as "verifiedat"')) {
          const row = reviews.get(Number(params[0]));
          return {
            rows: row ? [{
              status: row.status,
              verifiedAt: row.verified_at,
              verifiedByName: users.get(row.verified_by) ?? null,
              sourceDocumentId: row.source_document_id,
            }] : [],
          };
        }
        if (text.startsWith("insert into opportunity_documents")) {
          const [opportunityId, kind, label, url, createdBy] = params as [number, string, string, string, number];
          const row = {
            id: nextDocId++,
            opportunity_id: opportunityId,
            kind,
            label,
            url,
            created_by: createdBy,
            link_tested_at: null,
            link_tested_by: null,
            created_at: now,
          };
          documents.push(row);
          return { rows: [row] };
        }
        if (text.startsWith("insert into opportunity_document_reviews")) {
          const opportunityId = Number(params[0]);
          if (text.includes("'pending'")) {
            reviews.set(opportunityId, {
              status: "pending",
              verified_at: null,
              verified_by: null,
              source_document_id: null,
            });
          } else {
            const [verifiedOpportunityId, verifiedBy, sourceDocumentId] = params as [number, number, number];
            reviews.set(opportunityId, {
              status: "verified",
              verified_at: now,
              verified_by: verifiedBy,
              source_document_id: sourceDocumentId,
            });
            assert.equal(verifiedOpportunityId, opportunityId);
          }
          return { rows: [] };
        }
        if (text.startsWith("update opportunity_documents")) {
          const [userId, docId] = params as [number, number];
          const row = documents.find((doc) => doc.id === Number(docId));
          if (!row) return { rows: [] };
          row.link_tested_at = now;
          row.link_tested_by = Number(userId);
          return { rows: [{ ...row, opportunityId: row.opportunity_id, createdAt: row.created_at, linkTestedAt: now }] };
        }
        if (text.startsWith("select nome as")) {
          return { rows: [{ linkTestedByName: users.get(Number(params[0])) ?? null, verifiedByName: users.get(Number(params[0])) ?? null }] };
        }
        if (text.startsWith("select id from opportunity_documents")) {
          const [docId, opportunityId] = params as [number, number];
          const doc = documents.find((row) => row.id === Number(docId)
            && row.opportunity_id === Number(opportunityId)
            && row.kind === "fonte_oficial"
            && row.link_tested_at != null);
          return { rows: doc ? [{ id: doc.id }] : [] };
        }
        if (text.startsWith("select count(*)::integer as count")) {
          const opportunityId = Number(params[0]);
          return { rows: [{ count: documents.filter((doc) =>
            doc.opportunity_id === opportunityId && doc.link_tested_at == null).length }] };
        }
        if (text.startsWith("delete from opportunity_documents")) {
          const docId = Number(params[0]);
          const index = documents.findIndex((doc) => doc.id === docId);
          if (index < 0) return { rows: [] };
          const [removed] = documents.splice(index, 1);
          return { rows: [{ opportunityId: removed.opportunity_id }] };
        }
        throw new Error(`Unhandled opportunity documents query: ${text}`);
      },
    },
  };
}

async function startApp() {
  const testDb = createTestDatabase();
  const app = express();
  app.use(express.json());
  app.use(session({
    secret: "opportunity-documents-test-secret",
    resave: false,
    saveUninitialized: false,
  }));
  app.post("/test-login/:role", (req, res) => {
    req.session.user = {
      id: 7,
      email: "petron@example.test",
      nome: "Petron Admin",
      role: req.params.role as "ADMIN_PETRON" | "CLIENTE_ADMIN" | "USUARIO_CLIENTE",
      companyId: 1,
      companyName: "Petron",
    };
    res.sendStatus(204);
  });
  app.use(createOpportunityDocumentsRouter(testDb.database as never));

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

async function login(url: string, role: string): Promise<string> {
  const response = await fetch(`${url}/test-login/${role}`, { method: "POST" });
  assert.equal(response.status, 204);
  const cookie = response.headers.get("set-cookie");
  assert(cookie);
  return cookie.split(";")[0];
}

test("official source links are tied to one opportunity and require a manual test before review", async () => {
  const app = await startApp();
  try {
    const adminCookie = await login(app.url, "ADMIN_PETRON");
    const addSource = await fetch(`${app.url}/opportunities/1/documents`, {
      method: "POST",
      headers: { cookie: adminCookie, "content-type": "application/json" },
      body: JSON.stringify({
        kind: "fonte_oficial",
        label: "Fonte oficial da oportunidade 1",
        url: "https://www.petronect.com.br/portal/",
      }),
    });
    assert.equal(addSource.status, 201);
    const source = await addSource.json() as { id: number; opportunityId: number };
    assert.equal(source.opportunityId, 1);

    const addAttachment = await fetch(`${app.url}/opportunities/1/documents`, {
      method: "POST",
      headers: { cookie: adminCookie, "content-type": "application/json" },
      body: JSON.stringify({
        kind: "anexo",
        label: "Anexo técnico",
        url: "https://docs.example.test/anexo.pdf",
      }),
    });
    assert.equal(addAttachment.status, 201);
    const attachment = await addAttachment.json() as { id: number };

    const reviewBeforeTests = await fetch(`${app.url}/opportunities/1/documents/review`, {
      method: "POST",
      headers: { cookie: adminCookie, "content-type": "application/json" },
      body: JSON.stringify({ sourceDocumentId: source.id }),
    });
    assert.equal(reviewBeforeTests.status, 409);

    const testSource = await fetch(`${app.url}/opportunities/documents/${source.id}/test`, {
      method: "POST",
      headers: { cookie: adminCookie },
    });
    assert.equal(testSource.status, 200);
    const testAttachment = await fetch(`${app.url}/opportunities/documents/${attachment.id}/test`, {
      method: "POST",
      headers: { cookie: adminCookie },
    });
    assert.equal(testAttachment.status, 200);

    const review = await fetch(`${app.url}/opportunities/1/documents/review`, {
      method: "POST",
      headers: { cookie: adminCookie, "content-type": "application/json" },
      body: JSON.stringify({ sourceDocumentId: source.id }),
    });
    assert.equal(review.status, 200);

    const confirmed = await fetch(`${app.url}/opportunities/1/documents`, { headers: { cookie: adminCookie } });
    const confirmedState = await confirmed.json() as { documents: Array<{ opportunityId: number }>; review: { status: string } };
    assert.equal(confirmedState.review.status, "verified");
    assert(confirmedState.documents.every((doc) => doc.opportunityId === 1));

    const unrelatedReview = await fetch(`${app.url}/opportunities/2/documents/review`, {
      method: "POST",
      headers: { cookie: adminCookie, "content-type": "application/json" },
      body: JSON.stringify({ sourceDocumentId: source.id }),
    });
    assert.equal(unrelatedReview.status, 409);

    const addAnotherLink = await fetch(`${app.url}/opportunities/1/documents`, {
      method: "POST",
      headers: { cookie: adminCookie, "content-type": "application/json" },
      body: JSON.stringify({
        kind: "outro",
        label: "Atualização",
        url: "https://docs.example.test/atualizacao.pdf",
      }),
    });
    assert.equal(addAnotherLink.status, 201);
    const anotherLink = await addAnotherLink.json() as { id: number };
    const pending = await fetch(`${app.url}/opportunities/1/documents`, { headers: { cookie: adminCookie } });
    const pendingState = await pending.json() as { review: { status: string } };
    assert.equal(pendingState.review.status, "pending");

    const testNewLink = await fetch(`${app.url}/opportunities/documents/${anotherLink.id}/test`, {
      method: "POST",
      headers: { cookie: adminCookie },
    });
    assert.equal(testNewLink.status, 200);
    const renewedReview = await fetch(`${app.url}/opportunities/1/documents/review`, {
      method: "POST",
      headers: { cookie: adminCookie, "content-type": "application/json" },
      body: JSON.stringify({ sourceDocumentId: source.id }),
    });
    assert.equal(renewedReview.status, 200);
    const deleteLink = await fetch(`${app.url}/opportunities/documents/${anotherLink.id}`, {
      method: "DELETE",
      headers: { cookie: adminCookie },
    });
    assert.equal(deleteLink.status, 200);
    const afterDelete = await fetch(`${app.url}/opportunities/1/documents`, { headers: { cookie: adminCookie } });
    const afterDeleteState = await afterDelete.json() as { review: { status: string } };
    assert.equal(afterDeleteState.review.status, "pending");
  } finally {
    await app.close();
  }
});

test("clients can read curated links but cannot add, test, or verify them", async () => {
  const app = await startApp();
  try {
    const anonymous = await fetch(`${app.url}/opportunities/1/documents`);
    assert.equal(anonymous.status, 401);
    const clientCookie = await login(app.url, "CLIENTE_ADMIN");
    const read = await fetch(`${app.url}/opportunities/1/documents`, { headers: { cookie: clientCookie } });
    assert.equal(read.status, 200);
    const add = await fetch(`${app.url}/opportunities/1/documents`, {
      method: "POST",
      headers: { cookie: clientCookie, "content-type": "application/json" },
      body: JSON.stringify({ kind: "fonte_oficial", label: "Fonte", url: "https://petronect.com.br/" }),
    });
    assert.equal(add.status, 403);
  } finally {
    await app.close();
  }
});

test("official source links must use a Petronect domain", async () => {
  const app = await startApp();
  try {
    const adminCookie = await login(app.url, "ADMIN_PETRON");
    const response = await fetch(`${app.url}/opportunities/1/documents`, {
      method: "POST",
      headers: { cookie: adminCookie, "content-type": "application/json" },
      body: JSON.stringify({
        kind: "fonte_oficial",
        label: "Fonte externa",
        url: "https://example.test/fonte",
      }),
    });
    assert.equal(response.status, 400);
  } finally {
    await app.close();
  }
});
