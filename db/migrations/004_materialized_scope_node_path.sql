BEGIN;

-- Materialize the assigned node path so ACL subtree checks do not repeatedly
-- join node_scope_assignments back to nodes for every allow/deny predicate.
ALTER TABLE node_scope_assignments
  ADD COLUMN IF NOT EXISTS node_path ltree;

UPDATE node_scope_assignments assignment
SET node_path = node.path
FROM nodes node
WHERE node.id = assignment.node_id
  AND assignment.node_path IS DISTINCT FROM node.path;

ALTER TABLE node_scope_assignments
  ALTER COLUMN node_path SET NOT NULL;

CREATE OR REPLACE FUNCTION sync_scope_assignment_node_path()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  SELECT path INTO NEW.node_path FROM nodes WHERE id = NEW.node_id;
  IF NEW.node_path IS NULL THEN
    RAISE EXCEPTION 'scope assignment node % does not exist', NEW.node_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_scope_assignment_node_path ON node_scope_assignments;
CREATE TRIGGER trg_scope_assignment_node_path
BEFORE INSERT OR UPDATE OF node_id ON node_scope_assignments
FOR EACH ROW EXECUTE FUNCTION sync_scope_assignment_node_path();

CREATE OR REPLACE FUNCTION sync_materialized_scope_paths_on_node_move()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.path IS DISTINCT FROM OLD.path THEN
    UPDATE node_scope_assignments SET node_path = NEW.path WHERE node_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_node_scope_assignment_path_on_node_move ON nodes;
CREATE TRIGGER trg_node_scope_assignment_path_on_node_move
AFTER UPDATE OF path ON nodes
FOR EACH ROW EXECUTE FUNCTION sync_materialized_scope_paths_on_node_move();

CREATE INDEX IF NOT EXISTS idx_nsa_node_path_gist
  ON node_scope_assignments USING GIST (node_path);

CREATE INDEX IF NOT EXISTS idx_nsa_user_effect_propagation_path
  ON node_scope_assignments (user_id, assignment_effect, propagation)
  INCLUDE (role_id, node_path);

COMMIT;
