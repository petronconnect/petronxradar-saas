-- Shared, expiring authentication throttling state.
-- The limiter_key contains only a scope prefix and SHA-256 digest.
BEGIN;
CREATE TABLE IF NOT EXISTS auth_failure_limits (
  limiter_key text PRIMARY KEY,
  failures integer NOT NULL DEFAULT 0,
  pending integer NOT NULL DEFAULT 0,
  window_started_at timestamptz NOT NULL,
  blocked_until timestamptz NOT NULL,
  lockouts integer NOT NULL DEFAULT 0,
  pending_expires_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS auth_failure_limits_expires_at_idx
  ON auth_failure_limits (expires_at);
COMMIT;
