import assert from "node:assert/strict";
import { test } from "node:test";
import { once } from "node:events";
import express from "express";
import session from "express-session";
import { PgDialect } from "drizzle-orm/pg-core";
import { createRegistrationRouter } from "../src/routes/registration";

test("public registration creates only a pending inquiry; validates data, ownership, conflicts and throttling", async () => {
  const queries: string[] = [];
  let conflict = false;
  const database = { execute: async (query: any) => {
    const text = new PgDialect().sqlToQuery(query).sql;
    queries.push(text);
    if (text.includes("SELECT id FROM company_users")) return { rows: conflict ? [{ id: 99 }] : [] };
    if (text.includes("INSERT INTO inquiries")) return { rows: [{ id: 10 }] };
    throw new Error("Unexpected database mutation");
  }};
  const app = express();
  app.use(express.json());
  app.use(session({ secret: "test-only-registration", resave: false, saveUninitialized: false }));
  app.use(createRegistrationRouter(database as never));
  const server = app.listen(0, "127.0.0.1"); await once(server, "listening");
  const base = `http://127.0.0.1:${(server.address() as any).port}`;
  const input = { companyName: "Test", cnpj: "12345678000190", contactName: "Test",
    contactRole: "Diretor", email: "test@example.com", whatsapp: "11999999999", segment: "Serviços",
    servicesOffered: "Engenharia", cidade: "São Paulo", estado: "SP", planSlug: "radar-lancamento", allowContact: true };
  const submit = (body: unknown, cookie = "") => fetch(`${base}/auth/register`, {
    method: "POST", headers: { "content-type": "application/json", cookie }, body: JSON.stringify(body),
  });
  try {
    assert.equal((await submit({ ...input, planSlug: "free" })).status, 400);
    assert.equal((await submit({ ...input, email: "not-email" })).status, 400);
    const valid = await submit(input); assert.equal(valid.status, 201);
    assert.deepEqual(await valid.json(), { inquiryId: 10, checkoutPath: "/checkout/radar-lancamento" });
    const cookie = valid.headers.getSetCookie()[0].split(";")[0];
    const restored = await (await fetch(`${base}/auth/registration`, { headers: { cookie } })).json() as any;
    assert.equal(restored.registration.inquiryId, 10);
    const other = await (await fetch(`${base}/auth/registration`)).json() as any;
    assert.equal(other.registration, null);
    assert.equal((await submit(input, cookie)).status, 200);
    assert.equal(queries.filter(q => q.includes("INSERT")).length, 1);
    assert.ok(queries.every(q => !/INSERT INTO (company_users|company_accounts|subscriptions)/.test(q)));
    conflict = true;
    assert.equal((await submit(input)).status, 409);
    for (let i = 0; i < 6; i++) await submit({});
    assert.equal((await submit(input)).status, 429);
  } finally { await new Promise<void>(resolve => server.close(() => resolve())); }
});
