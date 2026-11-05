-- Development-only additive schema migration. Never run this against production.
BEGIN;
ALTER TABLE admin_recovery_audit
  DROP CONSTRAINT IF EXISTS admin_recovery_audit_result_check;
ALTER TABLE admin_recovery_audit
  ADD CONSTRAINT admin_recovery_audit_result_check
  CHECK (result IN ('in_progress', 'invalid_credential', 'rate_limited', 'success', 'unavailable', 'error', 'interrupted'));
COMMIT;
