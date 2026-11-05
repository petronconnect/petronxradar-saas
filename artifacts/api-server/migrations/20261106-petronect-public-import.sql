-- Additive development migration. Contains only public, admin-reviewed tender fields.
BEGIN;
CREATE TABLE IF NOT EXISTS petronect_public_import_runs (
  id serial PRIMARY KEY,
  file_name text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'success', 'failed')),
  total_rows integer NOT NULL DEFAULT 0,
  new_rows integer NOT NULL DEFAULT 0,
  updated_rows integer NOT NULL DEFAULT 0,
  unchanged_rows integer NOT NULL DEFAULT 0,
  duplicate_rows integer NOT NULL DEFAULT 0,
  invalid_rows integer NOT NULL DEFAULT 0,
  error_message text,
  preview_rows jsonb,
  created_by integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);
CREATE INDEX IF NOT EXISTS petronect_public_import_runs_created_at_idx
  ON petronect_public_import_runs (created_at DESC);
CREATE TABLE IF NOT EXISTS petronect_public_opportunities (
  id serial PRIMARY KEY,
  petronect_id text NOT NULL UNIQUE,
  title text NOT NULL,
  sub_status text,
  company text,
  scope text,
  start_date date,
  end_date date,
  process_type text,
  delivery_location text,
  last_import_run_id integer REFERENCES petronect_public_import_runs(id),
  source_first_seen_at timestamptz NOT NULL DEFAULT now(),
  source_updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS petronect_public_opportunities_source_updated_idx
  ON petronect_public_opportunities (source_updated_at DESC);
CREATE TABLE IF NOT EXISTS petronect_public_changes (
  id serial PRIMARY KEY,
  import_run_id integer NOT NULL REFERENCES petronect_public_import_runs(id),
  public_opportunity_id integer NOT NULL REFERENCES petronect_public_opportunities(id),
  change_type text NOT NULL CHECK (change_type IN ('new', 'updated')),
  before_data jsonb,
  after_data jsonb NOT NULL,
  changed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (import_run_id, public_opportunity_id)
);
CREATE INDEX IF NOT EXISTS petronect_public_changes_changed_at_idx
  ON petronect_public_changes (changed_at DESC);
COMMIT;
