# Backup operations

[English](BACKUP_OPERATIONS.en.md) | [Italiano](BACKUP_OPERATIONS.md)

Backup scheduling, destination, retention, encryption at rest, replication and
alerts belong to the deployment. The scripts in this repository are reference
implementations and must be adapted to the chosen operator or provider.

## PostgreSQL

Use `scripts/postgres-backup-verify.sh` for a custom-format dump and disposable
restore verification:

```bash
POSTGRES_CONTAINER=nodriva-postgres-1 \
BACKUP_ROOT=/protected/backups/postgres \
./scripts/postgres-backup-verify.sh backup-verify
```

The output and checksum are mode `0600`. The verification database is temporary
and its name contains `test`; the command never overwrites the source database.
Use a database container or direct tools according to the deployment, and keep
the archive, checksum and restore log in protected storage. A dump does not
contain attachment bytes or encryption keys.

## SQLite

Use `node scripts/sqlite-backup-verify.mjs backup-verify` for a consistent
`VACUUM INTO` snapshot, SHA-256 manifest and temporary `PRAGMA integrity_check`.
The operational file is never used as the restore destination. Schedule the
wrapper only after selecting a persistent protected destination and retention.

## Attachments and keys

Database metadata, attachment payloads and every key version used by them are a
single recovery set. Coordinate their capture at one recovery point, protect
the payload archive separately from the key material, and verify checksum and
decryption on a temporary restore. A database-only backup is not a complete
recovery for a deployment using attachments or encrypted fields.

## Status and monitoring

The Web may read a redacted `last-status.json` manifest, but it does not create,
modify or expose backup contents. Alert when the latest verified restore is
missing, failed or older than the deployment RPO. Keep at least one copy
off-host and test the actual restore procedure periodically.

Never run destructive verification against an operational database. Use a
dedicated database name containing `test`, synthetic credentials and disposable
storage. See [backup and restore](BACKUP_RESTORE.en.md) for the complete recovery
procedure and [operational readiness](OPERATIONS_READINESS.en.md) for release gates.
