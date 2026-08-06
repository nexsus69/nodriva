BEGIN;

ALTER TABLE node_type_fields
  ADD COLUMN IF NOT EXISTS relation_target_domain VARCHAR(16),
  ADD COLUMN IF NOT EXISTS relation_target_type_key VARCHAR(64);

ALTER TABLE entity_type_fields
  ADD COLUMN IF NOT EXISTS relation_target_domain VARCHAR(16),
  ADD COLUMN IF NOT EXISTS relation_target_type_key VARCHAR(64);

CREATE INDEX IF NOT EXISTS idx_node_type_fields_relation_target
  ON node_type_fields (relation_target_domain, relation_target_type_key)
  WHERE data_type = 'relation';

CREATE INDEX IF NOT EXISTS idx_entity_type_fields_relation_target
  ON entity_type_fields (relation_target_domain, relation_target_type_key)
  WHERE data_type = 'relation';

COMMIT;
