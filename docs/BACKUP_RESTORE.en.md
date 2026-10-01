# Verified backup and restore

[English](BACKUP_RESTORE.en.md) | [Italiano](BACKUP_RESTORE.md)

The included procedures are reference/test implementations. Backup, scheduling,
destination, retention and operational continuity belong to the operator and
may use external tools that preserve the same recovery and verification
requirements.

## SQLite standalone

The SQLite profile uses `node scripts/sqlite-backup-verify.mjs backup-verify`.
The script creates a consistent `VACUUM INTO` snapshot, calculates SHA-256,
copies it to a temporary restore path and runs `PRAGMA integrity_check` there.
The JSON manifest reports provider, checksum, size, schema version and
`restoreVerification: passed`; it never overwrites the operational database.

For standalone scheduling use `node scripts/sqlite-backup-maintenance.mjs`. The
wrapper applies an exclusive lock, retention and `last-status.json`, respecting
the `backup.scheduledEnabled` runtime policy. The concrete scheduler belongs to
deployment or the managed provider.

The supplied PostgreSQL procedure uses `pg_dump` custom format, SHA-256 checksum
and verification restore in a temporary database. The operational database is
never a destination of the `verify` command.

## Prerequisites

- a reachable PostgreSQL instance; the supplied script uses a container
  (`dashboard-db-pg17` in the local reference), while an external provider may
  require equivalent operator-selected tools;
- `docker`, `pg_restore` and `sha256sum` available on the host;
- enough space for at least two database copies during verification;
- a protected backup directory included in infrastructure encryption and
  replication strategy.

The dump contains application data, audit and potentially sensitive values. It
must be treated as a secret: mode `0600`, encryption at rest and access limited
to authorized operators.

## Complete recovery: database, attachments and keys

Database, attachment payloads and keyring are three coordinated artifacts.
PostgreSQL and SQLite manifests explicitly identify payloads and keys as
recovery dependencies; they do not archive or expose them.

At the same recovery point, preserve the attachment filesystem/mount copy and
the encryption-key versions used by the backup. Verify restore first on a
temporary copy; losing the keyring makes encrypted attachments or fields
unrecoverable even when the database is intact.

The PostgreSQL dump includes attachment records and metadata, not payloads in
the `dashboard_full_attachments` volume. Protect and replicate that volume in
coordination with the database dump. The application deliberately does not
introduce a second attachment archive format.

The optional `docker-compose.attachments-backup.yml` overlay provides
configurable filesystem-volume backup: `ATTACHMENTS_BACKUP_HOST_PATH` identifies
a deployment-selected mount. The job creates an archive, checksum and restore
in a temporary directory, comparing structure and payload hashes without
exposing content. Run it in the same cycle as the PostgreSQL dump; complete
restore requires both artifacts and corresponding keys.

## Creation and verification

```bash
./scripts/postgres-backup-verify.sh backup-verify
```

The command creates a file in `var/backups/postgres/` and its `.sha256`, checks
the checksum, validates archive readability and restores the dump into a
temporary database whose name always contains `test`. The temporary database
is removed even when verification fails. Verification queries only the restored
snapshot; it does not compare counts with the operational database, which may
change after dump creation. It checks the required schema, table readability
and structural archive integrity.

To use an explicit path:

```bash
./scripts/postgres-backup-verify.sh backup-verify /secure/backups/dashboard-$(date -u +%Y%m%d).dump
```

To verify an existing archive:

```bash
./scripts/postgres-backup-verify.sh verify /secure/backups/dashboard-20260811.dump
```

The adjacent `.sha256` file is mandatory for `verify`: a missing, malformed or
incorrect checksum stops the process before restore. Verification also checks
the presence and queryability of principal tables for users, nodes, entities,
types, audit, attachments, field encryption, realtime outbox and relationships.
For each active type it checks and counts the corresponding dynamic table. The
result reports aggregate counts only, useful for operational review without
exposing content or identifiers. It never compares a source database that may
have changed.

## Operational restore

Restore into the operational database is deliberately manual and requires a
maintenance window because it replaces current state. Before proceeding:

1. stop Web and workers that write to the database;
2. create a fresh backup of the current instance;
3. verify checksum and restore in a temporary database;
4. agree on target database and accepted data loss;
5. run `pg_restore` only with administrative credentials and retain logs;
6. restart services and verify login, ACL, audit, attachments, encryption and
   realtime.

When attachments are used, restore the coordinated volume copy before step 6
and verify that each `resource_attachments` record has its payload. A database-
only restore is not complete disaster recovery for that deployment.

The procedure does not automate step 5, preventing a destructive overwrite of
the operational database through an accidentally executed command.

## Frequency and retention

Backup must be scheduled externally with retention, an off-host copy, error
monitoring and an alert when the latest verified backup is absent. A backup is
valid only when temporary restore succeeded; file presence alone is not enough.

## Automated coverage

CI runs `pnpm db:backup:verify` against the test PostgreSQL service, using
`pg_dump` and `pg_restore` from the same server image. Restore always uses a
second temporary database. For SQLite it runs
`node scripts/sqlite-backup-verify.test.mjs` after the Core build, covering the
real application schema, a control record retained in the snapshot, manifest,
maintenance and policy-based pause.
