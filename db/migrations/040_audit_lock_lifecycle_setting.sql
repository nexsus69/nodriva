-- Allows operational lock acquisition/release evidence to be disabled centrally.
INSERT INTO system_settings (
  category,
  setting_key,
  display_name,
  description,
  value_type,
  value_text,
  is_runtime_overridable,
  is_system
)
VALUES (
  'governance',
  'audit.recordLockLifecycle',
  'Record ordinary lock activity',
  'Record lock acquisition and ordinary release events. Lock conflicts and administrative releases remain audited.',
  'boolean',
  'true',
  true,
  true
)
ON CONFLICT (setting_key) DO NOTHING;
