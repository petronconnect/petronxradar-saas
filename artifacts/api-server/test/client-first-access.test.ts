import assert from "node:assert/strict";
import { test } from "node:test";
import { recordSuccessfulLogin } from "../src/lib/client-first-access";

function createDatabase(role: string) {
  let firstLogin = true;
  let statements = 0;
  const database = {
    transaction: async (callback: (tx: { execute: () => Promise<{ rows: unknown[] }> }) => Promise<void>) =>
      callback({
        execute: async () => {
          statements++;
          if (firstLogin) {
            firstLogin = false;
            return { rows: [{ id: 42, role }] };
          }
          return { rows: [] };
        },
      }),
  };
  return { database, statementCount: () => statements };
}

test("a client's first successful login creates one welcome notice; later logins do not", async () => {
  const fake = createDatabase("CLIENTE_ADMIN");

  await recordSuccessfulLogin(fake.database as never, 42);
  assert.equal(fake.statementCount(), 2); // first-login timestamp + welcome notice

  await recordSuccessfulLogin(fake.database as never, 42);
  assert.equal(fake.statementCount(), 4); // subsequent login only updates the timestamp
});

test("a platform administrator does not receive the client welcome notice", async () => {
  const fake = createDatabase("ADMIN_PETRON");

  await recordSuccessfulLogin(fake.database as never, 42);
  assert.equal(fake.statementCount(), 1);
});
