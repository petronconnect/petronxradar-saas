import assert from "node:assert/strict";
import { test } from "node:test";
import { eligibleClaim } from "../src/lib/payment-claim";
import { completeRecoverableClaim, matchesRecovery, digest } from "../src/lib/payment-recovery";

test("payment claim requires approval, fresh one-time claim and a newly provisioned account", () => {
  const payment = { status: "approved", new_account_created: true, claim_token_hash: "hash", claimed_at: null };
  assert.equal(eligibleClaim(payment, "hash", undefined), true);
  for (const change of [
    { status: "pending" }, { status: "refunded" }, { new_account_created: false },
    { claimed_at: new Date() }, { claim_token_hash: null }, { claim_token_hash: "other" },
  ]) assert.equal(eligibleClaim({ ...payment, ...change }, "hash", undefined), false);
});
test("Google payment claim binds exact verified subject, issuer, email and expiration", () => {
  const payment = { status: "approved", new_account_created: true, claim_token_hash: "hash",
    claimed_at: null, google_subject: "subject", google_issuer: "issuer", google_email: "a@test.com" };
  const proof = { subject: "subject", issuer: "issuer", email: "a@test.com", expiresAt: 200 };
  assert.equal(eligibleClaim(payment, "hash", proof, 100), true);
  assert.equal(eligibleClaim(payment, "hash", undefined, 100), false);
  for (const change of [{ subject: "other" }, { issuer: "other" }, { email: "other@test.com" }, { expiresAt: 100 }]) {
    assert.equal(eligibleClaim(payment, "hash", { ...proof, ...change }, 100), false);
  }
});

test("failed session persistence never consumes claim; receipt survives and retry succeeds", async () => {
  let consumed = false, saved = false;
  const consume = async () => { assert.equal(saved, true); consumed = true; };
  await assert.rejects(completeRecoverableClaim(async () => { throw new Error("session store down"); }, consume));
  assert.equal(consumed, false);
  const token = "a".repeat(64), expires = new Date(Date.now() + 86400_000);
  assert.equal(matchesRecovery(token, digest(token), expires), true);
  await completeRecoverableClaim(async () => { saved = true; }, consume);
  assert.equal(consumed, true);
  // Receipt remains independently valid if the successful HTTP response was lost.
  assert.equal(matchesRecovery(token, digest(token), expires), true);
  assert.equal(matchesRecovery("b".repeat(64), digest(token), expires), false);
  assert.equal(matchesRecovery(token, digest(token), new Date(0)), false);
});

test("failed consumption after session save is recoverable without another payment", async () => {
  let saves = 0;
  await assert.rejects(completeRecoverableClaim(async () => { saves++; }, async () => { throw new Error("database down"); }));
  await completeRecoverableClaim(async () => { saves++; }, async () => {});
  assert.equal(saves, 2);
});
