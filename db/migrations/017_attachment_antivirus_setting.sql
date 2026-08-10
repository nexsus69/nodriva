INSERT INTO system_settings (
  category, setting_key, display_name, description, value_type,
  value_text, is_runtime_overridable, is_system
)
VALUES (
  'security', 'attachments.antivirusEnabled', 'Real-time attachment antivirus',
  'Scan uploaded attachments with the configured antivirus service before storage.',
  'boolean'::setting_value_type_enum, 'false', TRUE, TRUE
)
ON CONFLICT (setting_key) DO NOTHING;
