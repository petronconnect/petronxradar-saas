import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import type { Request, Response } from "express";
import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
export const recoveryCookie = "petron_payment_recovery";
const options = { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax" as const, path: "/api", maxAge: 7 * 86400_000 };
export const digest = (token: string) => createHash("sha256").update(token).digest("hex");
export function matchesRecovery(token: string, hash: string | null, expires: string | Date | null, now = Date.now()) {
  if (!hash || !expires || new Date(expires).getTime() <= now) return false;
  const expected = Buffer.from(hash, "hex"), actual = Buffer.from(digest(token), "hex");
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
export async function issueRecovery(paymentId: number, res: Response) {
  const token = randomBytes(32).toString("hex");
  await db.execute(sql`UPDATE payments SET recovery_token_hash = ${digest(token)},
    recovery_expires_at = NOW() + INTERVAL '7 days' WHERE id = ${paymentId}`);
  res.cookie(recoveryCookie, `${paymentId}.${token}`, options);
}
export async function readRecovery(req: Request, database: Pick<typeof db, "execute"> = db): Promise<any | undefined> {
  const value = req.headers.cookie?.split(";").map(x => x.trim())
    .find(x => x.startsWith(`${recoveryCookie}=`))?.slice(recoveryCookie.length + 1);
  const match = value?.match(/^(\d+)\.([a-f0-9]{64})$/);
  if (!match) return;
  const result = await database.execute(sql`SELECT * FROM payments WHERE id = ${Number(match[1])} LIMIT 1`);
  const payment = (result as any).rows?.[0];
  if (payment && matchesRecovery(match[2], payment.recovery_token_hash, payment.recovery_expires_at)) return payment;
}
export function clearRecovery(res: Response) { res.clearCookie(recoveryCookie, { path: "/api", httpOnly: true, secure: options.secure, sameSite: "lax" }); }

// Consumption must follow successful session persistence, never precede it.
export async function completeRecoverableClaim(saveSession: () => Promise<void>, consume: () => Promise<void>) {
  await saveSession();
  await consume();
}
