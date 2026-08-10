ALTER TABLE node_type_fields
  ADD COLUMN IF NOT EXISTS encryption_mode VARCHAR(10) NOT NULL DEFAULT 'inherit'
  CHECK (encryption_mode IN ('inherit', 'plaintext', 'encrypted'));

ALTER TABLE entity_type_fields
  ADD COLUMN IF NOT EXISTS encryption_mode VARCHAR(10) NOT NULL DEFAULT 'inherit'
  CHECK (encryption_mode IN ('inherit', 'plaintext', 'encrypted'));

CREATE TABLE IF NOT EXISTS resource_field_ciphertexts (
  resource_type VARCHAR(20) NOT NULL CHECK (resource_type IN ('node', 'entity')),
  resource_id UUID NOT NULL,
  field_key VARCHAR(64) NOT NULL,
  key_version VARCHAR(32) NOT NULL,
  ciphertext TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (resource_type, resource_id, field_key)
);

INSERT INTO system_settings (
  category, setting_key, display_name, description, value_type,
  value_text, is_runtime_overridable, is_system
)
VALUES (
  'security', 'data.fieldsEncryptionEnabled', 'Global field encryption',
  'Encrypt fields whose metadata policy is inherit.',
  'boolean'::setting_value_type_enum, 'false', TRUE, TRUE
)
ON CONFLICT (setting_key) DO NOTHING;
