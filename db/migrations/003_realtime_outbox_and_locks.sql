-- Canonical runtime schema for locking and durable realtime delivery.
-- Existing installations seeded with the historical resource_locks table are
-- migrated without dropping active locks.
CREATE TABLE IF NOT EXISTS locks (
  id UUID PRIMARY KEY,
  resource_type TEXT NOT NULL,
  resource_id TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  acquired_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  UNIQUE (resource_type, resource_id)
);

DO $$
BEGIN
  IF to_regclass('public.resource_locks') IS NOT NULL THEN
    INSERT INTO locks (id, resource_type, resource_id, user_id, acquired_at, expires_at)
    SELECT id, resource_kind::text, resource_id::text, lock_owner_user_id, acquired_at, expires_at
    FROM resource_locks
    ON CONFLICT (resource_type, resource_id) DO NOTHING;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_locks_expires_at ON locks (expires_at);

CREATE TABLE IF NOT EXISTS realtime_event_outbox (
  event_id UUID PRIMARY KEY,
  event_payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  published_at TIMESTAMPTZ NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  next_attempt_at TIMESTAMPTZ NULL,
  last_error TEXT NULL,
  locked_at TIMESTAMPTZ NULL,
  locked_by TEXT NULL
);

ALTER TABLE realtime_event_outbox ADD COLUMN IF NOT EXISTS locked_at TIMESTAMPTZ NULL;
ALTER TABLE realtime_event_outbox ADD COLUMN IF NOT EXISTS locked_by TEXT NULL;
CREATE INDEX IF NOT EXISTS idx_realtime_event_outbox_pending
  ON realtime_event_outbox (created_at)
  WHERE published_at IS NULL;
