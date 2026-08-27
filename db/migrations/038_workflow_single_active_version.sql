BEGIN;

-- Earlier engine versions allowed more than one active version of a workflow.
-- Preserve history while making the newest active definition the sole executor.
WITH ranked_active AS (
  SELECT workflow_id, version,
         row_number() OVER (PARTITION BY workflow_id ORDER BY version DESC) AS rank
  FROM workflow_definitions
  WHERE is_active=true
)
UPDATE workflow_definitions definition
SET is_active=false, updated_at=now()
FROM ranked_active
WHERE definition.workflow_id=ranked_active.workflow_id
  AND definition.version=ranked_active.version
  AND ranked_active.rank>1;

CREATE UNIQUE INDEX IF NOT EXISTS uq_workflow_definitions_one_active
  ON workflow_definitions (workflow_id) WHERE is_active;

COMMIT;
