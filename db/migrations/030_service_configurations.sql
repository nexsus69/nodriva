CREATE TABLE IF NOT EXISTS service_configurations (
  service_key VARCHAR(64) PRIMARY KEY,
  provider_key VARCHAR(64) NOT NULL,
  runtime_values JSONB NOT NULL DEFAULT '{}'::jsonb,
  row_version INTEGER NOT NULL DEFAULT 1,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT service_configurations_runtime_values_object
    CHECK (jsonb_typeof(runtime_values) = 'object'),
  CONSTRAINT service_configurations_row_version_positive
    CHECK (row_version >= 1)
);

GRANT SELECT, INSERT, UPDATE ON service_configurations TO dashboard_app;
