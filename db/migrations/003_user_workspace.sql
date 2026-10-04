BEGIN;

-- Keep rejected applications distinguishable from accounts later suspended by an administrator.
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_account_status_check;
UPDATE users u
SET account_status = 'rejected'
WHERE u.account_status = 'suspended'
  AND EXISTS (
    SELECT 1 FROM audit_events e
    WHERE e.entity_type = 'user_account'
      AND e.entity_id = u.id
      AND e.action = 'account_suspended'
      AND e.before_state ->> 'account_status' = 'pending'
  );
ALTER TABLE users ADD CONSTRAINT users_account_status_check
  CHECK (account_status IN ('pending', 'active', 'suspended', 'rejected'));

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS account_review_note text,
  ADD COLUMN IF NOT EXISTS account_reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS account_reviewed_by uuid REFERENCES users(id);

ALTER TABLE farms
  ADD COLUMN IF NOT EXISTS submitted_by uuid REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS verified_by uuid REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS verified_at timestamptz;

CREATE INDEX IF NOT EXISTS farms_owner_idx ON farms (submitted_by, created_at DESC);
CREATE INDEX IF NOT EXISTS harvest_reports_owner_idx ON harvest_reports (submitted_by, created_at DESC);
CREATE INDEX IF NOT EXISTS inventory_balances_owner_idx ON inventory_balances (submitted_by, created_at DESC);
CREATE INDEX IF NOT EXISTS marketplace_listings_owner_idx ON marketplace_listings (created_by, created_at DESC);
CREATE INDEX IF NOT EXISTS marketplace_orders_owner_idx ON marketplace_orders (created_by, created_at DESC);

COMMIT;
