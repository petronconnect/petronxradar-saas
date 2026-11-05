import { db, sql } from "@workspace/db";

type LimiterDatabase = Pick<typeof db, "execute" | "transaction">;

type FailureState = {
  failures: number;
  pending: number;
  windowStartedAt: number;
  blockedUntil: number;
  lockouts: number;
  pendingExpiresAt: number;
  expiresAt: number;
};

const PENDING_RESERVATION_TTL_MS = 2 * 60 * 1000;

function toRows(result: any): any[] {
  if (Array.isArray(result)) return result;
  if (result && Array.isArray(result.rows)) return result.rows;
  return [];
}

function toEpoch(value: Date | string | number): number {
  return value instanceof Date ? value.getTime() : new Date(value).getTime();
}

export class FailureLimiter {
  private readonly retentionMs: number;

  constructor(
    private readonly database: LimiterDatabase,
    private readonly maxFailures: number,
    private readonly windowMs: number,
    private readonly baseBlockMs: number,
    private readonly maxBlockMs: number,
  ) {
    this.retentionMs = windowMs + maxBlockMs;
  }

  async remainingMs(key: string, now = Date.now()): Promise<number> {
    return this.database.transaction(async (tx) => {
      await tx.execute(sql`
        DELETE FROM auth_failure_limits
        WHERE expires_at <= ${new Date(now)}
      `);
      const rows = toRows(await tx.execute(sql`
        SELECT failures, pending, window_started_at, blocked_until, lockouts,
               pending_expires_at, expires_at
        FROM auth_failure_limits
        WHERE limiter_key = ${key}
        FOR UPDATE
      `)) as Record<string, unknown>[];
      const row = rows[0];
      if (!row) return 0;

      const expiresAt = toEpoch(row.expires_at as Date | string);
      if (expiresAt <= now) {
        await tx.execute(sql`DELETE FROM auth_failure_limits WHERE limiter_key = ${key}`);
        return 0;
      }

      await tx.execute(sql`
        UPDATE auth_failure_limits
        SET expires_at = ${new Date(now + this.retentionMs)}
        WHERE limiter_key = ${key}
      `);
      return Math.max(0, toEpoch(row.blocked_until as Date | string) - now);
    });
  }

  async reserve(key: string, now = Date.now()): Promise<number> {
    return this.database.transaction(async (tx) => {
      await this.pruneExpired(tx, now);
      await this.insertIfMissing(tx, key, now);
      const state = await this.loadForUpdate(tx, key);
      if (!state) throw new Error("Failed to initialize shared authentication limiter");

      this.resetExpiredState(state, now);
      if (state.pendingExpiresAt <= now) state.pending = 0;
      const blockedMs = Math.max(0, state.blockedUntil - now);
      if (blockedMs > 0) {
        await this.save(tx, key, state, now);
        return blockedMs;
      }

      if (state.pending === 0 && now - state.windowStartedAt >= this.windowMs) {
        state.failures = 0;
        state.windowStartedAt = now;
      }
      if (state.failures + state.pending >= this.maxFailures) {
        await this.save(tx, key, state, now);
        return 1000;
      }

      state.pending += 1;
      state.pendingExpiresAt = now + PENDING_RESERVATION_TTL_MS;
      await this.save(tx, key, state, now);
      return 0;
    });
  }

  async cancel(key: string, now = Date.now()): Promise<void> {
    await this.database.transaction(async (tx) => {
      await this.pruneExpired(tx, now);
      const state = await this.loadForUpdate(tx, key);
      if (!state) return;
      this.resetExpiredState(state, now);
      if (state.pendingExpiresAt <= now) state.pending = 0;
      else state.pending = Math.max(0, state.pending - 1);
      await this.save(tx, key, state, now);
    });
  }

  async recordFailure(key: string, now = Date.now()): Promise<number> {
    return this.database.transaction(async (tx) => {
      await this.pruneExpired(tx, now);
      await this.insertIfMissing(tx, key, now);
      const state = await this.loadForUpdate(tx, key);
      if (!state) throw new Error("Failed to initialize shared authentication limiter");

      this.resetExpiredState(state, now);
      if (state.pendingExpiresAt <= now) state.pending = 0;
      else state.pending = Math.max(0, state.pending - 1);

      const blockedMs = Math.max(0, state.blockedUntil - now);
      if (blockedMs > 0) {
        await this.save(tx, key, state, now);
        return blockedMs;
      }

      if (now - state.windowStartedAt >= this.windowMs) {
        state.failures = 0;
        state.windowStartedAt = now;
      }

      state.failures += 1;
      if (state.failures < this.maxFailures) {
        await this.save(tx, key, state, now);
        return 0;
      }

      const blockMs = Math.min(this.baseBlockMs * 2 ** state.lockouts, this.maxBlockMs);
      state.blockedUntil = now + blockMs;
      state.lockouts += 1;
      state.failures = 0;
      state.windowStartedAt = now;
      await this.save(tx, key, state, now);
      return blockMs;
    });
  }

  async clear(key: string): Promise<void> {
    await this.database.execute(sql`
      DELETE FROM auth_failure_limits WHERE limiter_key = ${key}
    `);
  }

  private async pruneExpired(tx: { execute: (query: any) => Promise<unknown> }, now: number): Promise<void> {
    await tx.execute(sql`
      DELETE FROM auth_failure_limits
      WHERE expires_at <= ${new Date(now)}
    `);
  }

  private async insertIfMissing(
    tx: { execute: (query: any) => Promise<unknown> },
    key: string,
    now: number,
  ): Promise<void> {
    const date = new Date(now);
    await tx.execute(sql`
      INSERT INTO auth_failure_limits
        (limiter_key, failures, pending, window_started_at, blocked_until,
         lockouts, pending_expires_at, expires_at)
      VALUES (${key}, 0, 0, ${date}, ${date}, 0, ${date}, ${date})
      ON CONFLICT (limiter_key) DO NOTHING
    `);
  }

  private async loadForUpdate(
    tx: { execute: (query: any) => Promise<unknown> },
    key: string,
  ): Promise<FailureState | undefined> {
    const rows = toRows(await tx.execute(sql`
      SELECT failures, pending, window_started_at, blocked_until, lockouts,
             pending_expires_at, expires_at
      FROM auth_failure_limits
      WHERE limiter_key = ${key}
      FOR UPDATE
    `)) as Record<string, unknown>[];
    const row = rows[0];
    if (!row) return undefined;
    return {
      failures: Number(row.failures),
      pending: Number(row.pending),
      windowStartedAt: toEpoch(row.window_started_at as Date | string),
      blockedUntil: toEpoch(row.blocked_until as Date | string),
      lockouts: Number(row.lockouts),
      pendingExpiresAt: toEpoch(row.pending_expires_at as Date | string),
      expiresAt: toEpoch(row.expires_at as Date | string),
    };
  }

  private resetExpiredState(state: FailureState, now: number): void {
    if (state.expiresAt <= now) {
      state.failures = 0;
      state.pending = 0;
      state.windowStartedAt = now;
      state.blockedUntil = 0;
      state.lockouts = 0;
      state.pendingExpiresAt = now;
    }
  }

  private async save(
    tx: { execute: (query: any) => Promise<unknown> },
    key: string,
    state: FailureState,
    now: number,
  ): Promise<void> {
    state.expiresAt = now + this.retentionMs;
    await tx.execute(sql`
      UPDATE auth_failure_limits
      SET failures = ${state.failures},
          pending = ${state.pending},
          window_started_at = ${new Date(state.windowStartedAt)},
          blocked_until = ${new Date(state.blockedUntil)},
          lockouts = ${state.lockouts},
          pending_expires_at = ${new Date(state.pendingExpiresAt)},
          expires_at = ${new Date(state.expiresAt)}
      WHERE limiter_key = ${key}
    `);
  }
}
