# Verified backup and restore

[English](BACKUP_RESTORE.en.md) | [Italiano](BACKUP_RESTORE.md)

The included procedures are reference implementations. Scheduling, destination,
retention and continuity remain deployment responsibilities.

## SQLite standalone

`node scripts/sqlite-backup-verify.mjs backup-verify` creates a consistent
`VACUUM INTO` snapshot, SHA-256 checksum, manifest and temporary
`PRAGMA integrity_check`. It never overwrites the operational file.

## PostgreSQL

`scripts/postgres-backup-verify.sh backup-verify` creates a custom-format dump,
checksum and restore verification in a disposable database whose name contains
`test`. The verify command never restores over the source database. The dump
contains database records and metadata, not attachment bytes.

## Complete recovery set

Database, attachment payloads and every encryption-key version are coordinated
recovery artifacts. Preserve them at the same recovery point, in protected
storage and with keys stored separately. Losing the keyring can make otherwise
valid encrypted fields or attachments unrecoverable.

For deployments using attachments, archive the persistent attachment volume in
the same cycle as the database dump. Verify paths and checksums on a temporary
restore, then verify decryption and metadata size/checksum. A database-only
restore is not complete disaster recovery.

## Operational restore

An operational restore is deliberately manual because it replaces current
state. Stop Web and database-writing workers, create and verify a fresh current
backup, agree on the target and accepted data loss, restore with administrative
credentials, restore attachments and keys, then verify login, ACL, audit,
attachments, encryption and realtime. Never use the automatic verification
command as an operational overwrite command.

Keep one copy off-host, monitor the age and status of verified restores, and
test the actual procedure periodically. The Web may expose only sanitized
manifest evidence; it does not create or expose backup contents.
