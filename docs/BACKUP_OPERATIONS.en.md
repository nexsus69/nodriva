# Automatic backup operations

[English](BACKUP_OPERATIONS.en.md) | [Italiano](BACKUP_OPERATIONS.md)

These scripts and wrapper commands are optional operational tools supplied by
the repository. Nodriva does not manage backups on the operator's behalf. A
deployment may use equivalent procedures from its database provider, provided
that it includes verified restore and the required coordinated artifacts.

Verified backup can run automatically through
`scripts/postgres-backup-maintenance.sh`. The wrapper:

- prevents concurrent runs with `flock`;
- creates and verifies a PostgreSQL backup;
- applies configured retention;
- writes `last-status.json` with outcome and file references;
- returns a non-zero code on failure so the deployment scheduler or monitoring
  system can raise an alert.

Verification runs against a restored temporary database and never uses counts
from the live database. It therefore remains valid during concurrent writes and
for a historical archive.

In the reference/test Compose profile the same wrapper runs in the `backup`
service, connected directly to PostgreSQL over the Docker network; it does not
require access to the host Docker socket.

An administrator may pause scheduling from **Platform → Backup**. The
`backup.scheduledEnabled` runtime policy does not stop a deployment service: the
job records `paused` and does not create a dump. An operational manual backup
remains possible; restore is not exposed by the panel.

## Configuration

Available variables:

```text
BACKUP_ROOT=/secure/backups/dashboard/postgres
BACKUP_RETENTION_DAYS=30
BACKUP_STATUS_FILE=/secure/backups/dashboard/postgres/last-status.json
POSTGRES_CONTAINER=dashboard-db-pg17
POSTGRES_DATABASE=dashboard
POSTGRES_USER=postgres
```

The directory must be protected, encrypted and replicated off host. A backup
contains application data and must not be exposed through Web.

For standalone SQLite use the equivalent
`node scripts/sqlite-backup-maintenance.mjs`. It produces the same
`completed|paused|failed` status, applies retention and creates verified
snapshots in a temporary copy. `BACKUP_ROOT`, `BACKUP_RETENTION_DAYS` and
`BACKUP_STATUS_FILE` have the same semantics; also set
`SQLITE_DATABASE_PATH` to the operational file.

The manifest/status contains provider, format, checksum, size, verification
restore result and recovery dependencies. Attachments and the keyring remain
coordinated copies managed by deployment, not data exposed by the application.

## External scheduler

The scheduler belongs to the deployment and is not configured by Nodriva. Run
the wrapper with an explicit environment, redirect stdout/stderr to the log
system and connect exit codes to external alerting. The wrapper still maintains
locking, retention and status. A production installation must also check
`completedAt`, disk space and the presence of the off-host copy.
