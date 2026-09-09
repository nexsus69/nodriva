# Operational consolidation TODO

> **Status: active.** This list tracks the next bounded work after the
> cross-session lifecycle and browser-parity fixes. Complete an item only with
> its relevant automated checks and operational evidence.

## 1. Verified PostgreSQL recovery

- [ ] Run the isolated PostgreSQL backup/restore procedure against the current
  schema and representative canonical data.
- [ ] Verify restored schema, nodes, entities, dynamic values, relationships,
  attachments metadata and audit records.
- [ ] Verify that the procedure never targets the operational database and
  that every disposable database name contains `test`.
- [ ] Record the recovery result, duration and any remaining recovery
  limitations in the operational documentation.

**Done when:** the automated restore verification is green and a manual review
confirms the restored canonical vertical is readable and internally coherent.

## 2. Backup coverage for attachment content

- [ ] Establish whether the current PostgreSQL backup procedure includes the
  encrypted attachment files as well as their database metadata.
- [ ] Add an isolated restore verification for attachment content when it is
  part of the supported recovery contract.
- [ ] Document any deployment-owned storage replication or recovery step that
  remains outside Nodriva's database backup.

**Done when:** the documented recovery procedure restores every supported
attachment artifact, or explicitly identifies the operator-owned mechanism
that does so.

## 3. Healthcheck and observability acceptance

- [ ] Exercise `scripts/stack-healthcheck.sh` with the actual selected
  integrations: realtime, antivirus, monitoring and backup.
- [ ] Verify that a disabled optional integration is reported as disabled and
  does not look like a fault.
- [ ] Verify that a failed required dependency produces a clear unhealthy
  result without leaking configuration or secrets.
- [ ] Confirm Prometheus targets and the backup freshness state are healthy;
  define the external alert for missed backup/RPO expiry.

**Done when:** the full deployment healthcheck is green and each required
service has an actionable failure signal.

## 4. Operational release rehearsal

- [ ] Run the release checklist in an isolated environment: `pnpm check`,
  PostgreSQL integration/parity, `e2e:canonical`, `e2e:parity`, backup/restore
  and full-stack healthcheck.
- [ ] Capture exact commands, expected durations and rollback steps for the
  deployment operator.
- [ ] Keep production credentials and operational data out of test output and
  versioned files.

**Done when:** the rehearsal is reproducible from the documented procedure and
all evidence is green.
