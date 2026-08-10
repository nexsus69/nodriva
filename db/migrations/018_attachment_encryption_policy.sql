CREATE TABLE IF NOT EXISTS node_type_attachment_policies (
  node_type_id UUID PRIMARY KEY REFERENCES node_types(id) ON DELETE CASCADE,
  encryption_mode VARCHAR(10) NOT NULL DEFAULT 'inherit'
    CHECK (encryption_mode IN ('inherit', 'enabled', 'disabled')),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO system_settings (
  category, setting_key, display_name, description, value_type,
  value_text, is_runtime_overridable, is_system
)
VALUES (
  'security', 'attachments.encryptionEnabled', 'Global attachment encryption',
  'Encrypt new attachments unless overridden by the containing node type policy.',
  'boolean'::setting_value_type_enum, 'false', TRUE, TRUE
)
ON CONFLICT (setting_key) DO NOTHING;
