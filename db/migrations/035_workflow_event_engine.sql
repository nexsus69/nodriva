BEGIN;

-- The event/workflow engine is deliberately polymorphic: it models a subject
-- by kind and identifier, so new modules do not require a schema migration to
-- become workflow participants.
CREATE TABLE IF NOT EXISTS workflow_event_types (
  event_type TEXT PRIMARY KEY,
  subject_kinds JSONB NOT NULL,
  payload_version INTEGER NOT NULL CHECK (payload_version > 0),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS workflow_definitions (
  workflow_id TEXT NOT NULL,
  version INTEGER NOT NULL CHECK (version > 0),
  definition_payload JSONB NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (workflow_id, version)
);
CREATE INDEX IF NOT EXISTS idx_workflow_definitions_active
  ON workflow_definitions (workflow_id, version) WHERE is_active;

CREATE TABLE IF NOT EXISTS workflow_events (
  event_id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  subject_kind TEXT NOT NULL,
  subject_id TEXT NOT NULL,
  scope_id TEXT,
  event_payload JSONB NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_workflow_events_type_created
  ON workflow_events (event_type, created_at);

CREATE TABLE IF NOT EXISTS workflow_execution_plans (
  instance_key TEXT PRIMARY KEY,
  workflow_id TEXT NOT NULL,
  workflow_version INTEGER NOT NULL,
  event_id TEXT NOT NULL REFERENCES workflow_events(event_id) ON DELETE RESTRICT,
  plan_payload JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_workflow_execution_plans_event
  ON workflow_execution_plans (event_id, workflow_id, workflow_version);

CREATE TABLE IF NOT EXISTS workflow_execution_steps (
  execution_key TEXT PRIMARY KEY,
  instance_key TEXT NOT NULL REFERENCES workflow_execution_plans(instance_key) ON DELETE CASCADE,
  step_id TEXT NOT NULL,
  action_type TEXT NOT NULL,
  input_payload JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'leased', 'completed')),
  attempts INTEGER NOT NULL DEFAULT 0,
  next_attempt_at TIMESTAMPTZ,
  locked_at TIMESTAMPTZ,
  locked_by TEXT,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  UNIQUE (instance_key, step_id)
);
CREATE INDEX IF NOT EXISTS idx_workflow_execution_steps_pending
  ON workflow_execution_steps (status, next_attempt_at, created_at);

COMMIT;
