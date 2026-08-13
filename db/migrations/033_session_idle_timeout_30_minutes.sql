UPDATE system_settings
SET value_text = '1800',
    row_version = row_version + 1,
    updated_at = now()
WHERE setting_key = 'session.idleTimeoutSeconds'
  AND deleted_at IS NULL
  AND value_text IS DISTINCT FROM '1800';
