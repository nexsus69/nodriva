INSERT INTO runtime_capabilities (capability_key, name, default_status, description)
VALUES ('realtime', 'Realtime Synchronization', 'enabled'::capability_status_enum, 'Realtime cache synchronization')
ON CONFLICT (capability_key) DO NOTHING;
