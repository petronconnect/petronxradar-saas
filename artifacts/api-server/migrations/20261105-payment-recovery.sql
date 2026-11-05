-- Development only; production schema changes require the managed publish flow.
ALTER TABLE payments ADD COLUMN IF NOT EXISTS recovery_token_hash text;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS recovery_expires_at timestamptz;
