CREATE TABLE IF NOT EXISTS realtime_event_outbox (
  event_id UUID PRIMARY KEY,
  event_payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  published_at TIMESTAMPTZ NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  next_attempt_at TIMESTAMPTZ NULL,
  last_error TEXT NULL
);

CREATE INDEX IF NOT EXISTS idx_realtime_event_outbox_pending
  ON realtime_event_outbox (created_at)
  WHERE published_at IS NULL;
