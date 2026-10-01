# Encryption rotation job

[English](ENCRYPTION_ROTATION.en.md) | [Italiano](ENCRYPTION_ROTATION.md)

`encryption:rotate` runs outside the HTTP lifecycle in bounded batches. It
processes encrypted field sidecars and local attachment files using the same
application contract for PostgreSQL and SQLite.

## Prerequisites

1. Apply `db/migrations/029_encryption_rotation_jobs.sql`.
2. Create and verify a backup.
3. Configure old and new keys in the secret manager.
4. Select the new active version.
5. Keep the old key available for the whole operation.

```text
FIELD_ENCRYPTION_KEYS=v1=<old-key>,v2=<new-key>
FIELD_ENCRYPTION_ACTIVE_VERSION=v2
ATTACHMENTS_ENCRYPTION_KEYS=v1=<old-key>,v2=<new-key>
ATTACHMENTS_ENCRYPTION_ACTIVE_VERSION=v2
```

Never commit this configuration.

## Execution

```bash
ENCRYPTION_ROTATION_BATCH_SIZE=100 pnpm encryption:rotate
```

The job records progress in `encryption_rotation_jobs` and emits
`security.encryption_rotation.*` audit events. A failed job can be retried;
items already on the active version are skipped, making retries idempotent.

Do not remove the old key immediately after completion. First reconcile counts,
restore a backup with the new key and read sample data and attachments. Revoke
the old key only after those checks succeed.
