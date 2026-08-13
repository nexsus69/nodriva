DROP INDEX IF EXISTS uq_nodes_parent_id_path_label_active;

CREATE UNIQUE INDEX uq_nodes_parent_id_path_label_active
  ON nodes(parent_id, path_label)
  NULLS NOT DISTINCT
  WHERE deleted_at IS NULL;
