BEGIN;

-- Relationship metadata remains attached to a type field. Existing fields use
-- the historical scalar behaviour until an administrator explicitly enables a
-- multi-value field or target uniqueness.
ALTER TABLE node_type_fields
  ADD COLUMN IF NOT EXISTS relation_source_cardinality VARCHAR(8) NOT NULL DEFAULT 'one',
  ADD COLUMN IF NOT EXISTS relation_target_is_unique BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS relation_inverse_label VARCHAR(150);

ALTER TABLE entity_type_fields
  ADD COLUMN IF NOT EXISTS relation_source_cardinality VARCHAR(8) NOT NULL DEFAULT 'one',
  ADD COLUMN IF NOT EXISTS relation_target_is_unique BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS relation_inverse_label VARCHAR(150);

-- Before this migration a unique physical relation column was the only way to
-- model a target-side one constraint. Preserve that intent in the explicit
-- relationship metadata.
UPDATE node_type_fields
SET relation_target_is_unique = is_unique
WHERE lower(data_type) = 'relation' AND is_unique;

UPDATE entity_type_fields
SET relation_target_is_unique = is_unique
WHERE lower(data_type) = 'relation' AND is_unique;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'ck_node_type_fields_relation_source_cardinality'
  ) THEN
    ALTER TABLE node_type_fields
      ADD CONSTRAINT ck_node_type_fields_relation_source_cardinality
      CHECK (relation_source_cardinality IN ('one', 'many')) NOT VALID;
    ALTER TABLE node_type_fields
      VALIDATE CONSTRAINT ck_node_type_fields_relation_source_cardinality;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'ck_entity_type_fields_relation_source_cardinality'
  ) THEN
    ALTER TABLE entity_type_fields
      ADD CONSTRAINT ck_entity_type_fields_relation_source_cardinality
      CHECK (relation_source_cardinality IN ('one', 'many')) NOT VALID;
    ALTER TABLE entity_type_fields
      VALIDATE CONSTRAINT ck_entity_type_fields_relation_source_cardinality;
  END IF;
END $$;

-- The table is the canonical store. There are intentionally no polymorphic
-- foreign keys: source/target ownership is verified by the application layer
-- against their declared type metadata before an edge is persisted.
CREATE TABLE IF NOT EXISTS resource_relationships (
  source_field_id UUID NOT NULL,
  source_domain VARCHAR(16) NOT NULL CHECK (source_domain IN ('node', 'entity')),
  source_resource_id UUID NOT NULL,
  target_domain VARCHAR(16) NOT NULL CHECK (target_domain IN ('node', 'entity')),
  target_resource_id UUID NOT NULL,
  position INTEGER NOT NULL CHECK (position >= 0),
  source_cardinality VARCHAR(8) NOT NULL CHECK (source_cardinality IN ('one', 'many')),
  target_is_unique BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (source_field_id, source_domain, source_resource_id, target_domain, target_resource_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_resource_relationships_source_one
  ON resource_relationships (source_field_id, source_domain, source_resource_id)
  WHERE source_cardinality = 'one';

CREATE UNIQUE INDEX IF NOT EXISTS uq_resource_relationships_target_one
  ON resource_relationships (source_field_id, target_domain, target_resource_id)
  WHERE target_is_unique;

CREATE UNIQUE INDEX IF NOT EXISTS uq_resource_relationships_source_position
  ON resource_relationships (source_field_id, source_domain, source_resource_id, position);

CREATE INDEX IF NOT EXISTS idx_resource_relationships_incoming
  ON resource_relationships (target_domain, target_resource_id, source_field_id, position);

-- New multi-value relation fields use JSONB in the legacy dynamic table during
-- the compatibility period. Scalar fields retain UUID columns, so existing
-- installations do not need destructive table rewrites.
CREATE OR REPLACE FUNCTION public.dashboard_schema_add_entity_column(
  p_storage_table text,
  p_column_name text,
  p_data_type text,
  p_is_required boolean,
  p_is_unique boolean,
  p_default_value text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_type text;
  v_required boolean;
  v_unique boolean;
  v_default text;
  v_relation_cardinality text;
  v_pg_type text;
BEGIN
  SELECT f.data_type, f.is_required, f.is_unique, f.default_value_text,
         f.relation_source_cardinality
    INTO v_type, v_required, v_unique, v_default, v_relation_cardinality
  FROM public.entity_types t
  JOIN public.entity_type_fields f ON f.entity_type_id = t.id
  WHERE t.storage_table = p_storage_table AND f.column_name = p_column_name
    AND t.deleted_at IS NULL;

  IF NOT FOUND OR lower(v_type) IN ('file', 'image') THEN
    RAISE EXCEPTION 'Column is not a physical field registered for this entity type' USING ERRCODE = '42501';
  END IF;
  IF lower(v_type) <> lower(p_data_type)
     OR v_required IS DISTINCT FROM p_is_required
     OR v_unique IS DISTINCT FROM p_is_unique
     OR v_default IS DISTINCT FROM p_default_value THEN
    RAISE EXCEPTION 'DDL arguments do not match entity field metadata' USING ERRCODE = '22023';
  END IF;
  IF lower(v_type) = 'relation'
     AND (v_unique OR p_default_value IS NOT NULL) THEN
    RAISE EXCEPTION 'Relationship cardinality cannot use legacy unique or default storage flags' USING ERRCODE = '22023';
  END IF;
  IF to_regclass(format('public.%I', p_storage_table)) IS NULL THEN
    RAISE EXCEPTION 'Entity storage table does not exist' USING ERRCODE = '42P01';
  END IF;

  v_pg_type := CASE lower(v_type)
    WHEN 'string' THEN 'TEXT'
    WHEN 'text' THEN 'TEXT'
    WHEN 'integer' THEN 'INTEGER'
    WHEN 'number' THEN 'NUMERIC'
    WHEN 'decimal' THEN 'NUMERIC'
    WHEN 'boolean' THEN 'BOOLEAN'
    WHEN 'date' THEN 'TIMESTAMPTZ'
    WHEN 'datetime' THEN 'TIMESTAMPTZ'
    WHEN 'uuid' THEN 'UUID'
    WHEN 'relation' THEN CASE WHEN v_relation_cardinality = 'many' THEN 'JSONB' ELSE 'UUID' END
    WHEN 'json' THEN 'JSONB'
    WHEN 'array' THEN 'JSONB'
    WHEN 'enum' THEN 'TEXT'
    ELSE NULL
  END;
  IF v_pg_type IS NULL THEN
    RAISE EXCEPTION 'Unsupported physical field data type' USING ERRCODE = '22023';
  END IF;

  EXECUTE format('ALTER TABLE public.%I ADD COLUMN %I %s%s%s',
    p_storage_table,
    p_column_name,
    v_pg_type,
    CASE WHEN v_default IS NULL THEN '' ELSE format(' DEFAULT %L::%s', v_default, v_pg_type) END,
    CASE WHEN v_required THEN ' NOT NULL' ELSE '' END);
END
$$;

ALTER FUNCTION public.dashboard_schema_add_entity_column(text, text, text, boolean, boolean, text)
  OWNER TO dashboard_schema_manager;
REVOKE ALL ON FUNCTION public.dashboard_schema_add_entity_column(text, text, text, boolean, boolean, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.dashboard_schema_add_entity_column(text, text, text, boolean, boolean, text) TO dashboard_app;

-- Backfill node payload references. Invalid historical values are deliberately
-- skipped: the subsequent application validation reports them when edited
-- instead of making the migration fail on operational data.
INSERT INTO resource_relationships (
  source_field_id, source_domain, source_resource_id, target_domain,
  target_resource_id, position, source_cardinality, target_is_unique
)
SELECT
  field.id,
  'node',
  node.id,
  field.relation_target_domain,
  (node.payload ->> field.field_key)::uuid,
  0,
  field.relation_source_cardinality,
  field.relation_target_is_unique
FROM nodes node
JOIN node_type_fields field ON field.node_type_id = node.node_type_id
WHERE lower(field.data_type) = 'relation'
  AND field.relation_target_domain IS NOT NULL
  AND field.relation_target_type_key IS NOT NULL
  AND node.payload ? field.field_key
  AND (node.payload ->> field.field_key) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
ON CONFLICT DO NOTHING;

-- PostgreSQL entity fields were historically stored in type-specific tables.
-- The controlled dynamic DDL creates a UUID column for each relation field,
-- so a guarded dynamic query can backfill every registered type safely.
DO $$
DECLARE
  relation_field RECORD;
BEGIN
  FOR relation_field IN
    SELECT
      field.id AS field_id,
      field.column_name,
      field.relation_target_domain,
      field.relation_source_cardinality,
      field.relation_target_is_unique,
      entity_type.storage_table
    FROM entity_type_fields field
    JOIN entity_types entity_type ON entity_type.id = field.entity_type_id
    WHERE lower(field.data_type) = 'relation'
      AND field.relation_target_domain IS NOT NULL
      AND field.relation_target_type_key IS NOT NULL
      AND entity_type.storage_table ~ '^[a-z][a-z0-9_]{0,149}$'
  LOOP
    IF to_regclass(format('public.%I', relation_field.storage_table)) IS NOT NULL THEN
      EXECUTE format(
        'INSERT INTO resource_relationships (
           source_field_id, source_domain, source_resource_id, target_domain,
           target_resource_id, position, source_cardinality, target_is_unique
         )
         SELECT %L::uuid, ''entity'', entity.id, %L, values_table.%I, 0, %L, %L
         FROM public.%I values_table
         JOIN public.entities entity ON entity.id = values_table.entity_id
         WHERE values_table.%I IS NOT NULL
         ON CONFLICT DO NOTHING',
        relation_field.field_id,
        relation_field.relation_target_domain,
        relation_field.column_name,
        relation_field.relation_source_cardinality,
        relation_field.relation_target_is_unique,
        relation_field.storage_table,
        relation_field.column_name
      );
    END IF;
  END LOOP;
END $$;

COMMIT;
