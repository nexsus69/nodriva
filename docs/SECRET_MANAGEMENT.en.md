# Secret management: Infisical example

Self-hosted Infisical is an optional reference integration, not a Nodriva
requirement. An operator may use another secret manager or the protected secret
mechanisms of its orchestrator. Secret files are generated outside the
repository and must never be committed.

Use `./scripts/infisical-init-env.sh` to create an environment file without
overwriting an existing one. Keep `INFISICAL_*` endpoints and bindings in
deployment configuration, rotate credentials through the chosen manager, and
restart only the services that consume changed secrets. Logs, backups and
support bundles must redact secret values.
