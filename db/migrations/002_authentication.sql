BEGIN;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS password_salt text,
  ADD COLUMN IF NOT EXISTS password_hash text,
  ADD COLUMN IF NOT EXISTS account_status text NOT NULL DEFAULT 'pending'
    CHECK (account_status IN ('pending', 'active', 'suspended'));

CREATE UNIQUE INDEX IF NOT EXISTS users_email_lower_unique
  ON users (lower(email)) WHERE email IS NOT NULL;

CREATE TABLE IF NOT EXISTS roles (
  id smallint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name text NOT NULL UNIQUE CHECK (name IN (
    'farmer', 'buyer', 'cooperative_manager', 'warehouse_manager',
    'market_officer', 'sector_officer', 'district_officer', 'national_admin', 'analyst'
  ))
);

INSERT INTO roles (name) VALUES
  ('farmer'), ('buyer'), ('cooperative_manager'), ('warehouse_manager'),
  ('market_officer'), ('sector_officer'), ('district_officer'), ('national_admin'), ('analyst')
ON CONFLICT (name) DO NOTHING;

CREATE TABLE IF NOT EXISTS user_roles (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_id smallint NOT NULL REFERENCES roles(id),
  organization_id uuid REFERENCES organizations(id),
  geography_id uuid REFERENCES geographies(id),
  assigned_by uuid REFERENCES users(id),
  assigned_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS user_roles_lookup_idx ON user_roles (user_id, role_id);

CREATE TABLE IF NOT EXISTS auth_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash char(64) NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS auth_sessions_user_idx ON auth_sessions (user_id, expires_at);
CREATE INDEX IF NOT EXISTS users_pending_idx ON users (created_at) WHERE account_status = 'pending';

COMMIT;
