# Operational readiness

[English](OPERATIONS_READINESS.en.md) | [Italiano](OPERATIONS_READINESS.md)

This runbook verifies the reference Compose profile; it does not certify a
generic deployment or replace provider health checks, backups and alerts. For
direct Node.js SQLite/PostgreSQL deployments, use
[installation](INSTALLATION.en.md), [first run](FIRST_RUN.en.md) and
[Node.js operations](NODE_OPERATIONS.en.md).

## Health check

```bash
DASHBOARD_COMPOSE_INTEGRATIONS=realtime,antivirus,monitoring,backup \
  ./scripts/stack-healthcheck.sh
```

The check verifies the configured public login endpoint, Compose services,
PostgreSQL readiness, verified backup age and Prometheus target health when the
corresponding overlays are selected. It is read-only. Remote providers require
their own health checks and the sanitized Admin catalogue.

## Release evidence

Before release, run `pnpm check`, isolated PostgreSQL integration/parity,
canonical E2E and backup/restore verification. For standalone SQLite, verify
the selected adapter, persistent file, build and HTTP smoke test. Do not use
operational credentials, databases or attachments in these tests.

The complete Compose profile is a reference for development, demonstration and
reproducible testing, not a universal production prescription. Operators remain
responsible for HTTPS, secrets, availability, replication, retention, monitoring
and disaster recovery.
