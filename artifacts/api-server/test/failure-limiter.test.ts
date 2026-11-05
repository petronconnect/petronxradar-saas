import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { test } from "node:test";
import { FailureLimiter } from "../src/lib/failure-limiter";
import { FakeDatabase } from "./fake-database";

test("authentication limits are shared across limiter instances and expire without raw identifiers", async () => {
  const database = new FakeDatabase();
  const firstInstance = new FailureLimiter(database as never, 2, 60_000, 30_000, 120_000);
  const secondInstance = new FailureLimiter(database as never, 2, 60_000, 30_000, 120_000);
  const email = "private-user@example.test";
  const key = `account:${createHash("sha256").update(email).digest("hex")}`;
  const startedAt = Date.UTC(2026, 10, 5, 12);

  assert.equal(await firstInstance.recordFailure(key, startedAt), 0);
  assert.equal(await firstInstance.recordFailure(key, startedAt + 100), 30_000);
  assert.equal(await secondInstance.remainingMs(key, startedAt + 1_000), 29_100);
  assert.equal(database.authFailureLimits.size, 1);
  assert.equal([...database.authFailureLimits.keys()][0], key);
  assert.ok(![...database.authFailureLimits.keys()][0].includes(email));

  assert.equal(await secondInstance.remainingMs(key, startedAt + 60_000 + 120_000 + 101), 0);
  assert.equal(database.authFailureLimits.size, 0);
});
