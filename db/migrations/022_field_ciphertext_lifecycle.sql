BEGIN;

-- resource_field_ciphertexts is intentionally polymorphic because it stores
-- both node and entity values.  Keep its lifecycle synchronized with the
-- metadata/resource tables at the database boundary; application code alone
-- is not sufficient to preserve this invariant.
CREATE OR REPLACE FUNCTION public.dashboard_cleanup_field_ciphertexts_on_field_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF TG_TABLE_NAME = 'node_type_fields' THEN
    DELETE FROM public.resource_field_ciphertexts c
    USING public.nodes r
    WHERE c.resource_type = 'node'
      AND c.resource_id = r.id
      AND r.node_type_id = OLD.node_type_id
      AND c.field_key = OLD.field_key;
  ELSE
    DELETE FROM public.resource_field_ciphertexts c
    USING public.entities r
    WHERE c.resource_type = 'entity'
      AND c.resource_id = r.id
      AND r.entity_type_id = OLD.entity_type_id
      AND c.field_key = OLD.field_key;
  END IF;
  RETURN OLD;
END
$$;

CREATE OR REPLACE FUNCTION public.dashboard_cleanup_field_ciphertexts_on_resource_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  DELETE FROM public.resource_field_ciphertexts
  WHERE resource_type = TG_ARGV[0]
    AND resource_id = OLD.id;
  RETURN OLD;
END
$$;

REVOKE ALL ON FUNCTION public.dashboard_cleanup_field_ciphertexts_on_field_delete() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.dashboard_cleanup_field_ciphertexts_on_resource_delete() FROM PUBLIC;

DROP TRIGGER IF EXISTS dashboard_cleanup_entity_field_ciphertexts ON public.entity_type_fields;
CREATE TRIGGER dashboard_cleanup_entity_field_ciphertexts
AFTER DELETE ON public.entity_type_fields
FOR EACH ROW EXECUTE FUNCTION public.dashboard_cleanup_field_ciphertexts_on_field_delete();

DROP TRIGGER IF EXISTS dashboard_cleanup_node_field_ciphertexts ON public.node_type_fields;
CREATE TRIGGER dashboard_cleanup_node_field_ciphertexts
AFTER DELETE ON public.node_type_fields
FOR EACH ROW EXECUTE FUNCTION public.dashboard_cleanup_field_ciphertexts_on_field_delete();

DROP TRIGGER IF EXISTS dashboard_cleanup_entity_ciphertexts ON public.entities;
CREATE TRIGGER dashboard_cleanup_entity_ciphertexts
AFTER DELETE ON public.entities
FOR EACH ROW EXECUTE FUNCTION public.dashboard_cleanup_field_ciphertexts_on_resource_delete('entity');

DROP TRIGGER IF EXISTS dashboard_cleanup_node_ciphertexts ON public.nodes;
CREATE TRIGGER dashboard_cleanup_node_ciphertexts
AFTER DELETE ON public.nodes
FOR EACH ROW EXECUTE FUNCTION public.dashboard_cleanup_field_ciphertexts_on_resource_delete('node');

-- Repair only rows that cannot correspond to any existing field metadata.
-- This is part of installing the invariant on existing databases; future
-- deletes are handled by the triggers above in the same transaction.
DELETE FROM public.resource_field_ciphertexts c
WHERE NOT EXISTS (
  SELECT 1
  FROM public.nodes r
  JOIN public.node_type_fields f ON f.node_type_id = r.node_type_id
  WHERE c.resource_type = 'node'
    AND c.resource_id = r.id
    AND c.field_key = f.field_key
)
AND NOT EXISTS (
  SELECT 1
  FROM public.entities r
  JOIN public.entity_type_fields f ON f.entity_type_id = r.entity_type_id
  WHERE c.resource_type = 'entity'
    AND c.resource_id = r.id
    AND c.field_key = f.field_key
);

COMMIT;
