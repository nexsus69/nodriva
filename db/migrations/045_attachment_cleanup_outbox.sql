BEGIN;

CREATE TABLE IF NOT EXISTS attachment_cleanup_outbox (
  storage_key TEXT PRIMARY KEY,
  attempts INTEGER NOT NULL DEFAULT 0,
  next_attempt_at TIMESTAMPTZ NOT NULL,
  locked_at TIMESTAMPTZ,
  locked_by TEXT,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_attachment_cleanup_pending ON attachment_cleanup_outbox(next_attempt_at);

COMMIT;
