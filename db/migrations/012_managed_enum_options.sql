BEGIN;

CREATE TABLE IF NOT EXISTS node_type_field_enum_options (
  id UUID PRIMARY KEY,
  field_id UUID NOT NULL REFERENCES node_type_fields(id) ON DELETE CASCADE,
  value VARCHAR(100) NOT NULL,
  label VARCHAR(150) NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (field_id, value)
);
ALTER TABLE node_type_fields ADD COLUMN IF NOT EXISTS enum_mode VARCHAR(16) NOT NULL DEFAULT 'static';

CREATE TABLE IF NOT EXISTS entity_type_field_enum_options (
  id UUID PRIMARY KEY,
  field_id UUID NOT NULL REFERENCES entity_type_fields(id) ON DELETE CASCADE,
  value VARCHAR(100) NOT NULL,
  label VARCHAR(150) NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (field_id, value)
);
ALTER TABLE entity_type_fields ADD COLUMN IF NOT EXISTS enum_mode VARCHAR(16) NOT NULL DEFAULT 'static';

CREATE INDEX IF NOT EXISTS idx_node_enum_options_field ON node_type_field_enum_options(field_id, position);
CREATE INDEX IF NOT EXISTS idx_entity_enum_options_field ON entity_type_field_enum_options(field_id, position);

COMMIT;
