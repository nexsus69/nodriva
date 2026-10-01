# Deployment model

[English](DEPLOYMENT_MODEL.en.md) | [Italiano](DEPLOYMENT_MODEL.md)

Nodriva is a downloadable, operator-configured platform. Docker Compose is a
reference/test profile, not an application dependency or universal production
prescription.

## Supported profiles

| Profile | Persistence | Optional integrations |
| --- | --- | --- |
| PostgreSQL complete | PostgreSQL and persistent attachment storage | realtime, worker, antivirus, metrics, proxy and backup |
| SQLite standalone | Node.js, one persistent local file and attachment storage | realtime, antivirus and distributed services may be disabled |
| Reference Compose | local PostgreSQL and selected Compose overlays | enabled explicitly by the deployment |

The common application contract is the same across PostgreSQL and SQLite. Their
internal strategies may differ, but authorization, validation, locks,
`rowVersion`, errors, rollback and observable results must remain equivalent.

## Boundaries

Domain does not depend on frameworks or SQL. Application orchestrates use cases
through domain objects and ports. Infrastructure implements those ports.
Web accesses persistence only through services, ports and the composition root.
Authorization, validation, concurrency and encryption are backend authorities;
UI and cache are not authoritative.

Transactions persist data, audit and required outbox entries before post-commit
delivery. Optional services are explicitly disabled when their provider is not
configured; a running container alone does not enable a capability.

## Responsibilities

Nodriva supplies application behavior, migrations, reference adapters and
verification scripts. The operator chooses hosting, HTTPS, process management,
secret storage, database availability, attachment replication, backup schedule,
retention, alerts and disaster recovery. Provider-specific health checks remain
outside the generic application contract.

Before release, verify both declared persistence profiles when supported, use a
dedicated PostgreSQL database whose name contains `test` for destructive tests,
run parity and canonical E2E checks, and verify a coordinated database,
attachment and key restore.
