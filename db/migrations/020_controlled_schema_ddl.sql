BEGIN;

-- Runtime metadata changes must not grant generic DDL privileges to the web role.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'dashboard_schema_manager') THEN
    CREATE ROLE dashboard_schema_manager NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION;
  END IF;
END
$$;

REVOKE CREATE ON SCHEMA public FROM PUBLIC;
REVOKE CREATE ON SCHEMA public FROM dashboard_app;
GRANT USAGE, CREATE ON SCHEMA public TO dashboard_schema_manager;
GRANT SELECT ON entity_types, entity_type_fields TO dashboard_schema_manager;
GRANT REFERENCES ON entities TO dashboard_schema_manager;

-- Existing dynamic tables are moved to the controlled owner. Core tables remain
-- owned by the migration/operator role.
DO $$
DECLARE
  table_name text;
BEGIN
  FOR table_name IN
    SELECT DISTINCT storage_table
    FROM entity_types
    WHERE storage_table IS NOT NULL
      AND storage_table ~ '^[a-z][a-z0-9_]{0,149}$'
  LOOP
    IF to_regclass(format('public.%I', table_name)) IS NOT NULL THEN
      EXECUTE format('ALTER TABLE public.%I OWNER TO dashboard_schema_manager', table_name);
    END IF;
  END LOOP;
END
$$;

CREATE OR REPLACE FUNCTION public.dashboard_schema_create_entity_table(p_storage_table text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF p_storage_table IS NULL OR p_storage_table !~ '^[a-z][a-z0-9_]{0,149}$' THEN
    RAISE EXCEPTION 'Invalid entity storage table name' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.entity_types WHERE storage_table = p_storage_table AND deleted_at IS NULL) THEN
    RAISE EXCEPTION 'Storage table is not registered in entity metadata' USING ERRCODE = '42501';
  END IF;
  IF to_regclass(format('public.%I', p_storage_table)) IS NOT NULL THEN
    RAISE EXCEPTION 'Storage table already exists' USING ERRCODE = '42710';
  END IF;
  EXECUTE format('CREATE TABLE public.%I (entity_id UUID PRIMARY KEY REFERENCES public.entities(id) ON DELETE CASCADE)', p_storage_table);
END
$$;

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
  v_pg_type text;
BEGIN
  SELECT f.data_type, f.is_required, f.is_unique, f.default_value_text
    INTO v_type, v_required, v_unique, v_default
  FROM public.entity_types t
  JOIN public.entity_type_fields f ON f.entity_type_id = t.id
  WHERE t.storage_table = p_storage_table AND f.column_name = p_column_name AND t.deleted_at IS NULL;

  IF NOT FOUND OR lower(v_type) IN ('file', 'image') THEN
    RAISE EXCEPTION 'Column is not a physical field registered for this entity type' USING ERRCODE = '42501';
  END IF;
  IF lower(v_type) <> lower(p_data_type)
     OR v_required IS DISTINCT FROM p_is_required
     OR v_unique IS DISTINCT FROM p_is_unique
     OR v_default IS DISTINCT FROM p_default_value THEN
    RAISE EXCEPTION 'DDL arguments do not match entity field metadata' USING ERRCODE = '22023';
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
    WHEN 'relation' THEN 'UUID'
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

  IF v_unique THEN
    EXECUTE format('ALTER TABLE public.%I ADD CONSTRAINT %I UNIQUE (%I)', p_storage_table, 'uq_' || p_storage_table || '_' || p_column_name, p_column_name);
  END IF;
END
$$;

CREATE OR REPLACE FUNCTION public.dashboard_schema_update_entity_nullability(p_storage_table text, p_column_name text, p_is_required boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE v_required boolean;
BEGIN
  SELECT f.is_required INTO v_required FROM public.entity_types t JOIN public.entity_type_fields f ON f.entity_type_id = t.id
  WHERE t.storage_table = p_storage_table AND f.column_name = p_column_name AND t.deleted_at IS NULL;
  IF NOT FOUND OR v_required IS DISTINCT FROM p_is_required THEN RAISE EXCEPTION 'Nullability does not match entity field metadata' USING ERRCODE = '22023'; END IF;
  EXECUTE format('ALTER TABLE public.%I ALTER COLUMN %I %s', p_storage_table, p_column_name, CASE WHEN p_is_required THEN 'SET NOT NULL' ELSE 'DROP NOT NULL' END);
END
$$;

CREATE OR REPLACE FUNCTION public.dashboard_schema_update_entity_default(p_storage_table text, p_column_name text, p_default_value text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE v_type text; v_default text; v_pg_type text;
BEGIN
  SELECT f.data_type, f.default_value_text INTO v_type, v_default FROM public.entity_types t JOIN public.entity_type_fields f ON f.entity_type_id = t.id
  WHERE t.storage_table = p_storage_table AND f.column_name = p_column_name AND t.deleted_at IS NULL;
  IF NOT FOUND OR v_default IS DISTINCT FROM p_default_value THEN RAISE EXCEPTION 'Default does not match entity field metadata' USING ERRCODE = '22023'; END IF;
  v_pg_type := CASE lower(v_type) WHEN 'string' THEN 'TEXT' WHEN 'text' THEN 'TEXT' WHEN 'integer' THEN 'INTEGER' WHEN 'number' THEN 'NUMERIC' WHEN 'decimal' THEN 'NUMERIC' WHEN 'boolean' THEN 'BOOLEAN' WHEN 'date' THEN 'TIMESTAMPTZ' WHEN 'datetime' THEN 'TIMESTAMPTZ' WHEN 'uuid' THEN 'UUID' WHEN 'relation' THEN 'UUID' WHEN 'json' THEN 'JSONB' WHEN 'array' THEN 'JSONB' WHEN 'enum' THEN 'TEXT' ELSE NULL END;
  IF v_pg_type IS NULL THEN RAISE EXCEPTION 'Unsupported physical field data type' USING ERRCODE = '22023'; END IF;
  EXECUTE format('ALTER TABLE public.%I ALTER COLUMN %I %s', p_storage_table, p_column_name, CASE WHEN p_default_value IS NULL THEN 'DROP DEFAULT' ELSE format('SET DEFAULT %L::%s', p_default_value, v_pg_type) END);
END
$$;

CREATE OR REPLACE FUNCTION public.dashboard_schema_drop_entity_column(p_storage_table text, p_column_name text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE v_type text;
BEGIN
  SELECT f.data_type INTO v_type FROM public.entity_types t JOIN public.entity_type_fields f ON f.entity_type_id = t.id
  WHERE t.storage_table = p_storage_table AND f.column_name = p_column_name AND t.deleted_at IS NULL;
  IF NOT FOUND OR lower(v_type) IN ('file', 'image') THEN RAISE EXCEPTION 'Column is not a removable physical field' USING ERRCODE = '42501'; END IF;
  EXECUTE format('ALTER TABLE public.%I DROP COLUMN %I', p_storage_table, p_column_name);
END
$$;

CREATE OR REPLACE FUNCTION public.dashboard_schema_create_entity_unique(p_storage_table text, p_column_name text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.entity_types t JOIN public.entity_type_fields f ON f.entity_type_id = t.id WHERE t.storage_table = p_storage_table AND f.column_name = p_column_name AND f.is_unique AND t.deleted_at IS NULL) THEN RAISE EXCEPTION 'Unique constraint is not enabled by field metadata' USING ERRCODE = '42501'; END IF;
  EXECUTE format('ALTER TABLE public.%I ADD CONSTRAINT %I UNIQUE (%I)', p_storage_table, 'uq_' || p_storage_table || '_' || p_column_name, p_column_name);
END
$$;

CREATE OR REPLACE FUNCTION public.dashboard_schema_drop_entity_unique(p_storage_table text, p_column_name text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.entity_types t JOIN public.entity_type_fields f ON f.entity_type_id = t.id WHERE t.storage_table = p_storage_table AND f.column_name = p_column_name AND f.is_unique AND t.deleted_at IS NULL) THEN RAISE EXCEPTION 'Unique constraint is still enabled by field metadata' USING ERRCODE = '22023'; END IF;
  EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT IF EXISTS %I', p_storage_table, 'uq_' || p_storage_table || '_' || p_column_name);
END
$$;

CREATE OR REPLACE FUNCTION public.dashboard_schema_create_entity_index(p_storage_table text, p_column_name text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.entity_types t JOIN public.entity_type_fields f ON f.entity_type_id = t.id WHERE t.storage_table = p_storage_table AND f.column_name = p_column_name AND f.is_indexed AND t.deleted_at IS NULL) THEN RAISE EXCEPTION 'Index is not enabled by field metadata' USING ERRCODE = '42501'; END IF;
  EXECUTE format('CREATE INDEX %I ON public.%I (%I)', 'idx_' || p_storage_table || '_' || p_column_name, p_storage_table, p_column_name);
END
$$;

CREATE OR REPLACE FUNCTION public.dashboard_schema_drop_entity_index(p_storage_table text, p_column_name text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.entity_types t JOIN public.entity_type_fields f ON f.entity_type_id = t.id WHERE t.storage_table = p_storage_table AND f.column_name = p_column_name AND f.is_indexed AND t.deleted_at IS NULL) THEN RAISE EXCEPTION 'Index is still enabled by field metadata' USING ERRCODE = '22023'; END IF;
  EXECUTE format('DROP INDEX IF EXISTS public.%I', 'idx_' || p_storage_table || '_' || p_column_name);
END
$$;

ALTER FUNCTION public.dashboard_schema_create_entity_table(text) OWNER TO dashboard_schema_manager;
ALTER FUNCTION public.dashboard_schema_add_entity_column(text, text, text, boolean, boolean, text) OWNER TO dashboard_schema_manager;
ALTER FUNCTION public.dashboard_schema_update_entity_nullability(text, text, boolean) OWNER TO dashboard_schema_manager;
ALTER FUNCTION public.dashboard_schema_update_entity_default(text, text, text) OWNER TO dashboard_schema_manager;
ALTER FUNCTION public.dashboard_schema_drop_entity_column(text, text) OWNER TO dashboard_schema_manager;
ALTER FUNCTION public.dashboard_schema_create_entity_unique(text, text) OWNER TO dashboard_schema_manager;
ALTER FUNCTION public.dashboard_schema_drop_entity_unique(text, text) OWNER TO dashboard_schema_manager;
ALTER FUNCTION public.dashboard_schema_create_entity_index(text, text) OWNER TO dashboard_schema_manager;
ALTER FUNCTION public.dashboard_schema_drop_entity_index(text, text) OWNER TO dashboard_schema_manager;

REVOKE ALL ON FUNCTION public.dashboard_schema_create_entity_table(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.dashboard_schema_add_entity_column(text, text, text, boolean, boolean, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.dashboard_schema_update_entity_nullability(text, text, boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.dashboard_schema_update_entity_default(text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.dashboard_schema_drop_entity_column(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.dashboard_schema_create_entity_unique(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.dashboard_schema_drop_entity_unique(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.dashboard_schema_create_entity_index(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.dashboard_schema_drop_entity_index(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.dashboard_schema_create_entity_table(text) TO dashboard_app;
GRANT EXECUTE ON FUNCTION public.dashboard_schema_add_entity_column(text, text, text, boolean, boolean, text) TO dashboard_app;
GRANT EXECUTE ON FUNCTION public.dashboard_schema_update_entity_nullability(text, text, boolean) TO dashboard_app;
GRANT EXECUTE ON FUNCTION public.dashboard_schema_update_entity_default(text, text, text) TO dashboard_app;
GRANT EXECUTE ON FUNCTION public.dashboard_schema_drop_entity_column(text, text) TO dashboard_app;
GRANT EXECUTE ON FUNCTION public.dashboard_schema_create_entity_unique(text, text) TO dashboard_app;
GRANT EXECUTE ON FUNCTION public.dashboard_schema_drop_entity_unique(text, text) TO dashboard_app;
GRANT EXECUTE ON FUNCTION public.dashboard_schema_create_entity_index(text, text) TO dashboard_app;
GRANT EXECUTE ON FUNCTION public.dashboard_schema_drop_entity_index(text, text) TO dashboard_app;

COMMIT;
