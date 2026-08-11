BEGIN;

-- DDL remains restricted to dashboard_schema_manager.  The application role
-- still needs ordinary CRUD access to registered dynamic entity tables.
DO $$
DECLARE
  storage_table text;
BEGIN
  FOR storage_table IN
    SELECT et.storage_table
    FROM public.entity_types et
    WHERE et.storage_table IS NOT NULL
      AND et.storage_table ~ '^[a-z][a-z0-9_]{0,149}$'
      AND et.deleted_at IS NULL
  LOOP
    IF to_regclass(format('public.%I', storage_table)) IS NOT NULL THEN
      EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.%I TO dashboard_app', storage_table);
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
  EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.%I TO dashboard_app', p_storage_table);
END
$$;

ALTER FUNCTION public.dashboard_schema_create_entity_table(text) OWNER TO dashboard_schema_manager;
REVOKE ALL ON FUNCTION public.dashboard_schema_create_entity_table(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.dashboard_schema_create_entity_table(text) TO dashboard_app;

COMMIT;
