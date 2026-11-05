-- Development-only additive schema migration. Never run this against production.
BEGIN;
ALTER TABLE inquiries ADD COLUMN IF NOT EXISTS cidade text;
ALTER TABLE inquiries ADD COLUMN IF NOT EXISTS estado text;
ALTER TABLE company_users ADD COLUMN IF NOT EXISTS password_enabled boolean NOT NULL DEFAULT true;
CREATE TABLE IF NOT EXISTS google_identities (
  id serial PRIMARY KEY,
  user_id integer NOT NULL UNIQUE REFERENCES company_users(id) ON DELETE CASCADE,
  issuer text NOT NULL,
  subject text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (issuer, subject)
);
CREATE TABLE IF NOT EXISTS oauth_flows (
  state_hash text PRIMARY KEY,
  browser_hash text NOT NULL,
  purpose text NOT NULL CHECK (purpose IN ('login', 'link', 'register', 'reauth')),
  user_id integer REFERENCES company_users(id) ON DELETE CASCADE,
  nonce text NOT NULL,
  verifier text NOT NULL,
  destination text NOT NULL,
  expires_at timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS oauth_flows_expiry_idx ON oauth_flows(expires_at);
ALTER TABLE payments ADD COLUMN IF NOT EXISTS google_issuer text;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS google_subject text;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS google_email text;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS new_account_created boolean NOT NULL DEFAULT false;
COMMIT;
