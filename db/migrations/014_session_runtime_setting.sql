BEGIN;

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
  'security',
  'session.idleTimeoutSeconds',
  'Session inactivity timeout',
  'Maximum inactivity duration in seconds. Heartbeat, polling and lock TTL are derived from this value.',
  'integer'::setting_value_type_enum,
  '300',
  TRUE,
  TRUE
)
ON CONFLICT (setting_key) DO NOTHING;

COMMIT;
