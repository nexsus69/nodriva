# Operational consolidation TODO

> **Status: active.** This list tracks the next bounded work after the
> cross-session lifecycle and browser-parity fixes. Complete an item only with
> its relevant automated checks and operational evidence.

## 1. Verified PostgreSQL recovery

- [x] Run the isolated PostgreSQL backup/restore procedure against the current
  schema and representative canonical data.
- [x] Verify restored schema, nodes, entities, dynamic values, relationships,
  attachments metadata and audit records.
- [x] Verify that the procedure never targets the operational database and
  that every disposable database name contains `test`.
- [x] Record the recovery result, duration and any remaining recovery
  limitations in the operational documentation.

**Done when:** the automated restore verification is green and a manual review
confirms the restored canonical vertical is readable and internally coherent.

**Recorded exercise — 2026-09-21 (Europe/Rome):** a read-only dump of
`dashboard` was restored into the generated disposable database
`dashboard_restore_test_20260920231743_1682`, then dropped by the verifier.
The source database was never a restore target. The aggregate result was 3
users, 21 nodes, 175 entities, 848 audit records, 3 attachment metadata
records, 37 relationship records, 12 dynamic tables and 175 dynamic rows. The
complete dump/checksum/restore exercise took 2 seconds. Attachment payloads
and encryption key material remain coordinated deployment artifacts; their
coverage is addressed in section 2.

## 2. Backup coverage for attachment content

- [x] Establish whether the current PostgreSQL backup procedure includes the
  encrypted attachment files as well as their database metadata.
- [ ] Add an isolated restore verification for attachment content when it is
  part of the supported recovery contract.
- [x] Document any deployment-owned storage replication or recovery step that
  remains outside Nodriva's database backup.

**Current finding:** PostgreSQL dumps contain `resource_attachments` metadata
only. Payload files are in the deployment volume `nodriva_nodriva_attachments`
mounted at `/app/data/attachments`; the current database backup does not copy
that volume. `BACKUP_RESTORE.md` therefore requires a coordinated,
deployment-owned encrypted copy and restore of the volume together with the
matching encryption key material. The implementation intentionally does not
invent a second attachment archive or overwrite the volume automatically.

**Done when:** the documented recovery procedure restores every supported
attachment artifact, or explicitly identifies the operator-owned mechanism
that does so.

## 3. Healthcheck and observability acceptance

- [x] Exercise `scripts/stack-healthcheck.sh` with the actual selected
  integrations: realtime, antivirus, monitoring and backup.
- [x] Verify that a disabled optional integration is reported as disabled and
  does not look like a fault.
- [x] Verify that a failed required dependency produces a clear unhealthy
  result without leaking configuration or secrets.
- [x] Confirm Prometheus targets and the backup freshness state are healthy.
- [ ] Define the external alert for missed backup/RPO expiry.

**Done when:** the full deployment healthcheck is green and each required
service has an actionable failure signal.

**Recorded exercise — 2026-09-21 (Europe/Rome):** the complete profile
`realtime,antivirus,monitoring,backup` passed `stack-healthcheck.sh` with
PostgreSQL, Web, proxy, Soketi, realtime worker, ClamAV, backup and Prometheus
healthy. The verified backup was 54,643 seconds old, within the configured
93,600-second RPO threshold. The base profile also passed with optional
integrations omitted. Failure injection has not been run because it would
interrupt a live deployment; a non-invasive missing-project simulation instead
returned `ERROR: compose service is not running: postgres` without leaking
configuration. An external alert destination for missed RPO is still a
deployment-owner decision.

## 4. Operational release rehearsal

- [x] Run the release checklist in an isolated environment: `pnpm check`,
  PostgreSQL integration/parity, `e2e:canonical`, `e2e:parity`, backup/restore
  and full-stack healthcheck.
- [ ] Capture exact commands, expected durations and rollback steps for the
  deployment operator.
- [x] Keep production credentials and operational data out of test output and
  versioned files.

**Done when:** the rehearsal is reproducible from the documented procedure and
all evidence is green.

**Recorded rehearsal — 2026-09-21 (Europe/Rome):** `pnpm check`, the isolated
`pnpm test:postgres:local`, `pnpm e2e:parity`, the PostgreSQL
backup/checksum/restore exercise, and the complete-profile healthcheck all
passed. The E2E run included the canonical vertical. Test output contained
only aggregate recovery counts and disposable test database names; no
credentials or application records were emitted. The remaining release
operator work is to agree the external alert destination, attachment-volume
replication, exact timing baseline and the infrastructure rollback runbook.
