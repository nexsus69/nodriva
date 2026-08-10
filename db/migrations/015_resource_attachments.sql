CREATE TABLE IF NOT EXISTS resource_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resource_type VARCHAR(20) NOT NULL CHECK (resource_type IN ('node', 'entity')),
  resource_id UUID NOT NULL,
  field_key VARCHAR(64) NOT NULL,
  kind VARCHAR(10) NOT NULL CHECK (kind IN ('file', 'image')),
  file_name VARCHAR(255) NOT NULL,
  mime_type VARCHAR(255) NOT NULL,
  size_bytes BIGINT NOT NULL CHECK (size_bytes >= 0),
  storage_key VARCHAR(1024) NOT NULL UNIQUE,
  checksum VARCHAR(128),
  created_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_resource_attachments_resource
  ON resource_attachments (resource_type, resource_id, field_key, created_at DESC);
