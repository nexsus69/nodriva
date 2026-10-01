# Product and deployment model

[English](DEPLOYMENT_MODEL.en.md) | [Italiano](DEPLOYMENT_MODEL.md)

> **Status: normative.** This document distinguishes the application contract,
> reference/test profiles supplied by the repository and operator
> responsibilities. Operational documents provide procedure details.

## Platform contract

Nodriva is a downloadable, configurable platform, not a managed SaaS service or
a ready-made vertical application. It always requires persistence selected and
managed by the operator:

- PostgreSQL is the primary complete profile and may be an existing external
  instance; Docker is not an application requirement;
- SQLite is the supported standalone profile with Node.js and a local file;
- common capabilities have the same observable outcome in both adapters, while
  distributed integrations may be disabled.

Realtime/broker, antivirus, secret manager, scheduled backup, proxy/HTTPS,
metrics/alerting and separate workers are optional integrations or processes
selected by deployment. Their absence is normal when the capability is
disabled. When enabled, its configuration must be complete and deployment must
verify its health.

Attachment storage is required only when attachments are used. The current
implementation uses a local or mounted filesystem; an object-storage provider
is not implemented and must not be presented as available.

## Profiles supplied by the repository

| Profile | Purpose | Contents |
| --- | --- | --- |
| Node.js + SQLite | local standalone | Web, SQLite file and attachment filesystem; no external service required |
| Node.js + external PostgreSQL | operator-selected deployment | Web through `DATABASE_URL`; operator manages or omits migrations/bootstrap, proxy and integrations |
| `docker-compose.full.yml` | reference/test profile | local PostgreSQL, migrations/bootstrap, Web and Caddy |
| Compose overlay | optional examples | Soketi/worker, ClamAV, Prometheus and backup jobs selected separately |
| `docker-compose.postgres-test.yml` | isolated destructive tests | database name containing `test` and restricted-role bootstrap |

The Compose profile is not a universal production-ready distribution. The base
file includes local PostgreSQL and proxy and is not the supplied path for
reusing an external PostgreSQL instance. The `docker/web` image uses a
PostgreSQL entrypoint; standalone SQLite starts directly with Node.js. A custom
orchestrator may reuse application configuration but must manage migrations,
bootstrap, restricted credentials, storage, TLS and lifecycle.

## Operator responsibilities

The operator chooses and protects the database, attachment filesystem,
endpoints, credentials and keys; applies migrations; configures TLS and
networking; decides which integrations to enable; monitors availability and
queues; defines backup, retention, replication and restore; and keeps database,
attachments and keyring together. Repository procedures and examples are not
an SLA, managed service or certification of the resulting deployment.

The administrative panel exposes sanitized status and runtime policy. It does
not create external services, change deployment topology or replace controls of
the orchestrator or provider.

## Operational source map

| Area | Authoritative or example source |
| --- | --- |
| application and adapter boundaries | `ARCHITECTURE.md`, `ARCHITECTURAL_PORTABILITY.md` |
| runtime/deployment/secret classification | `SERVICE_CONFIGURATION_ARCHITECTURE.md`, `RUNTIME_CONFIGURATION_CATALOG.md` |
| Compose profile and overlays | `DOCKER_COMPOSE_FULL.md`, `docker-compose*.yml`, `scripts/docker-compose-profile-contract.sh` |
| initial configuration | `.env.example`, `.env.infisical.example` |
| PostgreSQL migrations/bootstrap | `db/README.md`, `docker/db-migrate/`, `docker/db-seed/` |
| supplied images and processes | `docker/*/Dockerfile`, `docker/web/runtime-entrypoint.sh`, `docker/realtime-worker/` |
| backup and restore | `BACKUP_RESTORE.md`, `BACKUP_OPERATIONS.md`, `scripts/*backup*` |
| security and secrets | `SECURITY.md`, `SECURITY_OPERATIONS.md`, `SECRET_MANAGEMENT.md` |
| health and observability | `OPERATIONS_READINESS.md`, `scripts/stack-healthcheck.sh`, `docker/prometheus/` |
| Core/Web configuration | `packages/core/src/application/config/`, `packages/web/src/server/EnvironmentServiceConfiguration.ts`, `packages/web/src/server/db.ts` |
| profile tests | `.github/workflows/ci.yml`, `docker-compose.postgres-test.yml`, `scripts/admin-parity-e2e.sh` |

`docker-compose.yml` is a separate legacy/minimal file: it does not start Web
and does not represent a complete Nodriva installation.
