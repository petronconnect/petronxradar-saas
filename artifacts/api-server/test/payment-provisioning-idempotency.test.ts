import assert from "node:assert/strict";
import { test } from "node:test";
import { provisionAccessForPayment } from "../src/lib/provisioning";
import { FakeDatabase } from "./fake-database";

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

class PaymentProvisioningDatabase extends FakeDatabase {
  readonly payment: Record<string, any> = {
    id: 501,
    status: "approved",
    inquiry_id: null,
    plan_slug: "radar-lancamento",
    amount: 500,
    payer_email: "pix-admin@exemplo.test",
    payer_name: "Empresa Pix",
    payer_cnpj: "12.345.678/0001-90",
    provisioned_at: null,
    provisioned_user_id: null,
    new_account_created: false,
  };

  override async execute(query: any): Promise<{ rows: Record<string, any>[] }> {
    const { text, params } = compileQuery(query);

    if (text.startsWith("select * from payments where id =")) {
      return { rows: Number(params[0]) === this.payment.id ? [{ ...this.payment }] : [] };
    }

    if (text.startsWith("select id, company_id, must_set_password, onboarding_completed from company_users")) {
      const user = this.users.find((row) => row.id === Number(params[0]));
      return {
        rows: user ? [{
          id: user.id,
          company_id: user.company_id,
          must_set_password: user.must_set_password,
          onboarding_completed: user.onboarding_completed,
        }] : [],
      };
    }

    if (text.startsWith("select id, company_id from company_users where lower(email) = lower(")) {
      const email = String(params[0]).toLowerCase();
      const user = this.users.find((row) => row.email.toLowerCase() === email);
      return { rows: user ? [{ id: user.id, company_id: user.company_id }] : [] };
    }

    if (text.startsWith("update payments set provisioned_at = now(), provisioned_user_id =")) {
      this.payment.provisioned_at = new Date().toISOString();
      this.payment.provisioned_user_id = Number(params[0]);
      this.payment.new_account_created = Boolean(params[1]);
      return { rows: [] };
    }

    return super.execute(query);
  }
}

test("repeated approved Pix provisioning returns the original account without changing credentials or duplicating records", async () => {
  const database = new PaymentProvisioningDatabase();

  const first = await provisionAccessForPayment(database.payment.id, database as never);
  assert.equal(first.ok, true);
  assert.equal(first.alreadyProvisioned, undefined);
  assert.ok(first.companyId);
  assert.ok(first.userId);

  const originalPasswordHash = database.users[0].password_hash;
  const originalCredentialFlags = {
    must_set_password: database.users[0].must_set_password,
    onboarding_completed: database.users[0].onboarding_completed,
  };

  const retry = await provisionAccessForPayment(database.payment.id, database as never);
  assert.equal(retry.ok, true);
  assert.equal(retry.alreadyProvisioned, true);
  assert.equal(retry.companyId, first.companyId);
  assert.equal(retry.userId, first.userId);
  assert.deepEqual({
    must_set_password: database.users[0].must_set_password,
    onboarding_completed: database.users[0].onboarding_completed,
  }, originalCredentialFlags);
  assert.equal(database.users[0].password_hash, originalPasswordHash);

  assert.deepEqual(database.counts(), {
    companies: 1,
    users: 1,
    subscriptions: 1,
    bulletins: 1,
  });
  assert.equal(database.payment.provisioned_user_id, first.userId);
  assert.equal(database.companies[0].id, first.companyId);
  assert.equal(database.users[0].company_id, first.companyId);
  assert.equal(database.subscriptions[0].company_id, first.companyId);
  assert.equal(database.bulletins[0].company_id, first.companyId);
});
