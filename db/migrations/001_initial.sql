BEGIN;

CREATE TABLE IF NOT EXISTS geographies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code char(2) NOT NULL DEFAULT 'RW',
  district_name text NOT NULL,
  sector_name text,
  cell_name text,
  village_name text
);

CREATE UNIQUE INDEX IF NOT EXISTS geographies_natural_key_idx ON geographies (
  country_code,
  lower(district_name),
  coalesce(lower(sector_name), ''),
  coalesce(lower(cell_name), ''),
  coalesce(lower(village_name), '')
);

CREATE TABLE IF NOT EXISTS organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  organization_type text NOT NULL CHECK (organization_type IN ('farmer', 'cooperative', 'buyer', 'warehouse', 'market', 'government', 'other')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id),
  display_name text NOT NULL,
  contact_reference text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS crops (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  active boolean NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS seasons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  starts_on date NOT NULL,
  ends_on date NOT NULL,
  CHECK (ends_on >= starts_on),
  UNIQUE (name, starts_on)
);

CREATE TABLE IF NOT EXISTS farms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  geography_id uuid NOT NULL REFERENCES geographies(id),
  cultivated_area_ha numeric(12, 3) CHECK (cultivated_area_ha IS NULL OR cultivated_area_ha >= 0),
  location_point text,
  verification_status text NOT NULL DEFAULT 'submitted' CHECK (verification_status IN ('submitted', 'verified', 'rejected')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS harvest_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id uuid REFERENCES farms(id),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  crop_id uuid NOT NULL REFERENCES crops(id),
  season_id uuid REFERENCES seasons(id),
  geography_id uuid NOT NULL REFERENCES geographies(id),
  report_type text NOT NULL CHECK (report_type IN ('intention', 'progress', 'actual')),
  quantity_kg numeric(14, 3) NOT NULL CHECK (quantity_kg >= 0),
  expected_harvest_on date,
  report_date date NOT NULL,
  source text NOT NULL,
  source_reference text,
  notes text,
  verification_status text NOT NULL DEFAULT 'submitted' CHECK (verification_status IN ('submitted', 'verified', 'rejected')),
  submitted_by uuid NOT NULL REFERENCES users(id),
  verified_by uuid REFERENCES users(id),
  verified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((verification_status = 'verified' AND verified_by IS NOT NULL AND verified_at IS NOT NULL) OR verification_status <> 'verified')
);

CREATE TABLE IF NOT EXISTS inventory_balances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  crop_id uuid NOT NULL REFERENCES crops(id),
  geography_id uuid NOT NULL REFERENCES geographies(id),
  quantity_kg numeric(14, 3) NOT NULL CHECK (quantity_kg >= 0),
  available_kg numeric(14, 3) NOT NULL CHECK (available_kg >= 0 AND available_kg <= quantity_kg),
  as_of timestamptz NOT NULL,
  source text NOT NULL,
  verification_status text NOT NULL DEFAULT 'submitted' CHECK (verification_status IN ('submitted', 'verified', 'rejected')),
  submitted_by uuid NOT NULL REFERENCES users(id),
  verified_by uuid REFERENCES users(id),
  verified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((verification_status = 'verified' AND verified_by IS NOT NULL AND verified_at IS NOT NULL) OR verification_status <> 'verified')
);

CREATE TABLE IF NOT EXISTS marketplace_listings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_organization_id uuid NOT NULL REFERENCES organizations(id),
  crop_id uuid NOT NULL REFERENCES crops(id),
  geography_id uuid NOT NULL REFERENCES geographies(id),
  available_quantity numeric(14, 3) NOT NULL CHECK (available_quantity >= 0),
  unit text NOT NULL DEFAULT 'kg',
  price_per_unit numeric(14, 2) CHECK (price_per_unit IS NULL OR price_per_unit >= 0),
  currency char(3) NOT NULL DEFAULT 'RWF',
  available_from date,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'reserved', 'fulfilled', 'withdrawn')),
  verification_status text NOT NULL DEFAULT 'submitted' CHECK (verification_status IN ('submitted', 'verified', 'rejected')),
  source text NOT NULL,
  created_by uuid NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS marketplace_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid NOT NULL REFERENCES marketplace_listings(id),
  buyer_organization_id uuid NOT NULL REFERENCES organizations(id),
  quantity numeric(14, 3) NOT NULL CHECK (quantity > 0),
  agreed_price_per_unit numeric(14, 2) CHECK (agreed_price_per_unit IS NULL OR agreed_price_per_unit >= 0),
  currency char(3) NOT NULL DEFAULT 'RWF',
  status text NOT NULL DEFAULT 'requested' CHECK (status IN ('requested', 'accepted', 'rejected', 'in_delivery', 'completed', 'cancelled')),
  created_by uuid NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS audit_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  actor_user_id uuid REFERENCES users(id),
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  action text NOT NULL,
  reason text,
  before_state jsonb,
  after_state jsonb,
  occurred_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS harvest_reports_dashboard_idx ON harvest_reports (report_type, verification_status, report_date DESC);
CREATE INDEX IF NOT EXISTS inventory_available_idx ON inventory_balances (verification_status, as_of DESC) WHERE available_kg > 0;
CREATE INDEX IF NOT EXISTS listings_open_idx ON marketplace_listings (status, verification_status, created_at DESC) WHERE status = 'open';
CREATE INDEX IF NOT EXISTS audit_entity_idx ON audit_events (entity_type, entity_id, occurred_at DESC);

COMMIT;
