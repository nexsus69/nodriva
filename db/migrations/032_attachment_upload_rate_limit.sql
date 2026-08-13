CREATE TABLE IF NOT EXISTS attachment_upload_events (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  actor_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_attachment_upload_events_actor_time
  ON attachment_upload_events(actor_id, occurred_at);
