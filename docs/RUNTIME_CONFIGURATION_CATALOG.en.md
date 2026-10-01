# Runtime configuration and deployment catalog

This catalog classifies backend configuration before it is introduced. Stable
operational settings belong in deployment configuration or a secret manager;
tenant or business settings may belong in `system_settings`; credentials never
belong in source control. The current implementation is transitional: registry,
resolver and PostgreSQL persistence exist, while some providers still read
environment variables directly.

Document every setting with owner, scope, default, mutability, secret status,
validation and restart requirements. Keep the catalog aligned with
`SERVICE_CONFIGURATION_ARCHITECTURE.md` and expose only safe settings in the
administrative UI.
