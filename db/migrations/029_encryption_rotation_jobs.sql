CREATE TABLE IF NOT EXISTS encryption_rotation_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  status VARCHAR(16) NOT NULL CHECK (status IN ('running', 'completed', 'failed')),
  target_key_version VARCHAR(32) NOT NULL,
  batch_size INTEGER NOT NULL CHECK (batch_size BETWEEN 1 AND 1000),
  fields_processed BIGINT NOT NULL DEFAULT 0,
  attachments_processed BIGINT NOT NULL DEFAULT 0,
  last_attachment_id UUID,
  error_message TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON encryption_rotation_jobs TO dashboard_app;
