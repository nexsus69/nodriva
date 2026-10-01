# Encryption rotation job

[English](ENCRYPTION_ROTATION.en.md) | [Italiano](ENCRYPTION_ROTATION.md)

`encryption:rotate` runs outside the HTTP lifecycle in bounded batches. It
processes both `resource_field_ciphertexts` and local attachment files. The
PostgreSQL and SQLite profiles use the same application contract for fields
marked `encrypted`: plaintext does not remain in the primary payload storage,
is kept in the `resource_field_ciphertexts` sidecar, restored on read through
application repositories/read models that expose the payload, and redacted in
revision snapshots.

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

The job creates a row in `encryption_rotation_jobs`, updates counters and emits
`security.encryption_rotation.*` audit events. On failure it marks the job
`failed`; it can be retried after the cause is corrected. Items already on the
active version are skipped, making retries idempotent and effectively resuming
from the reached point.

Do not remove the old key immediately after completion. First reconcile counts,
restore a backup with the new key and read sample data and attachments. Revoke
the old key only after those checks succeed.
