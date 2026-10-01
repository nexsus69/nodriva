# Operational readiness

[English](OPERATIONS_READINESS.en.md) | [Italiano](OPERATIONS_READINESS.md)

This runbook verifies the reference/test Compose profile. It does not certify a
generic deployment or replace health checks, backups, alerts or procedures from
the provider selected by the operator.

For SQLite or PostgreSQL started directly with Node.js, use
[installation](INSTALLATION.en.md), [first run](FIRST_RUN.en.md) and the
[Node.js runbook](NODE_OPERATIONS.en.md), without Docker containers.

## Health check

The check is read-only and verifies the application endpoint, reference Compose
container state, Docker health checks and PostgreSQL availability. Verified
backup and Prometheus targets are checked only when their Compose overlays are
selected:

```bash
./scripts/stack-healthcheck.sh
```

The public URL is required and must match deployment configuration:

```bash
DASHBOARD_PUBLIC_URL=https://dashboard.example.com ./scripts/stack-healthcheck.sh
```

The default Compose project is `nodriva`; use `NODRIVA_COMPOSE_PROJECT` when
deployment uses another name. A verified backup may be at most 93600 seconds
(26 hours) old; adjust the threshold with `BACKUP_MAX_AGE_SECONDS` for the
deployment RPO. To require optional-service checks, pass the same deployment
profiles:

```bash
DASHBOARD_COMPOSE_INTEGRATIONS=realtime,antivirus,monitoring,backup \
  ./scripts/stack-healthcheck.sh
```

With `backup`, the check fails when `last-status.json` is incomplete or too old;
with `monitoring`, when Prometheus is not ready or its target is `down`. Without
those profiles, absent containers are normal. Remote providers require their
own health checks and the Admin catalogue; this script intentionally covers
only local Compose containers.

## Service release baseline

The 2026-09-02 baseline validates the base PostgreSQL profile without
integrations, the complete profile with `realtime`, `antivirus`, `monitoring`
and `backup`, and SQLite/PostgreSQL parity. Selected overlays can be declared
for healthcheck through `DASHBOARD_COMPOSE_INTEGRATIONS`; this variable is not
part of Nodriva runtime or standalone SQLite.

The `pnpm test:compose` contract, run in CI, verifies that the base stack
renders without realtime secrets and explicit activation includes every optional
service. It does not start containers: complete boot remains an isolated
operational check. For external services, the provider/orchestrator owns
operational verification; Nodriva does not require Docker or an operating
system scheduler.

## Isolated CI verification

CI runs PostgreSQL integration and contract tests with a restricted role,
PostgreSQL restore in a temporary database and SQLite snapshot/restore against
the application schema. The browser job has two profiles: `parity` keeps
realtime explicitly disabled and includes recovery with an audit error and
retry; `realtime` uses Soketi with test credentials and `pnpm e2e:realtime`.

The realtime job verifies WebSocket frames for lock acquire/release, updating a
node in the second session without reload, outbox publication and worker-endpoint
protection. Seeing a change only after polling does not satisfy the realtime
test.

CI checks do not certify HTTPS, antivirus, external alerts or coordinated
attachment/key recovery in the target deployment.

## Verified backup and restore

A backup is valid only after restore in a temporary database:

```bash
./scripts/postgres-backup-verify.sh backup-verify
```

The procedure never overwrites the operational database: automatic restore uses
a disposable database marked `test`. The `backup` container job maintains
maintenance lock, retention and status file. The stack health check validates
`last-status.json`; deployment must also configure an independent alert when
state is not `completed` or verified backup exceeds the agreed RPO.

## Pre-release checklist

- `./scripts/stack-healthcheck.sh` completed;
- verified backup and restore completed when deployment offers backup;
- `pnpm check` completed;
- CI job **PostgreSQL integration and adapter parity** completed without skips;
- `pnpm e2e:full` completed with isolated fixtures and realtime; prepare the
  PostgreSQL test database as described in
  [DEVELOPMENT_WORKFLOW.md](DEVELOPMENT_WORKFLOW.en.md), without operational
  credentials;
- `pnpm e2e:parity` completed against test PostgreSQL and temporary SQLite,
  including Admin panel and canonical vertical;
- for standalone, `DATABASE_ADAPTER=sqlite` and `SQLITE_DATABASE_PATH` set,
  Web build and HTTP smoke completed;
- keys and passwords supplied by secret manager, never versioned files;
- HTTPS proxy configured for non-local environments;
- logs and metrics/alerting verified when observability is enabled;
- test browser sessions closed and no lock remains in the database;
- rollback procedure documented and current backup available.

The complete Compose profile is intended for development, demonstration and
reproducible testing, not as a universal production-ready solution. An
operational deployment must be designed and validated by the operator,
including secrets, HTTPS, availability, retention, replication, monitoring and
recovery.
