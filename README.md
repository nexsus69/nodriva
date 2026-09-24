# Nodriva

[![CI](https://github.com/nexsus69/nodriva/actions/workflows/ci.yml/badge.svg)](https://github.com/nexsus69/nodriva/actions/workflows/ci.yml)

Nodriva is an open-source platform for defining and managing connected data
structures without imposing a specific application domain. It provides generic
primitives—nodes, types, entities, fields, references, and attachments—from
which operational, administrative, or back-office applications can be built.

## Main capabilities

- Hierarchical nodes and connected resources.
- Types and fields configurable from the administration panel.
- Schema-driven forms with specialized renderers.
- Protection against losing unsaved operational and administrative changes.
- ACLs, roles, scopes, and operation auditing.
- Optimistic locks and realtime updates for concurrent changes.
- Soft deletion, trash, and subtree restoration.
- Attachments with optional antivirus scanning.
- Configurable encryption for fields and attachments.
- Application cache invalidation driven by realtime events.
- PostgreSQL backups with verified restore.
- Reference Docker Compose stack for development and staging, with optional integrations.

Nodriva is not a ready-made CRM, ERP, or ITSM product. It is a generic
infrastructure for modelling data and relationships while leaving use cases to
the application domain.

Nodriva is downloaded and operated in infrastructure chosen by its user; it is
not a hosted SaaS or a managed deployment. Persistence is mandatory. PostgreSQL
may be an existing external instance, while SQLite supports a local standalone
profile. Broker, antivirus, secret manager, backup scheduler, proxy, metrics and
separate workers are optional integrations selected by the operator.

## Architecture

The monorepo contains:

- `packages/core`: domain, application services, ports, and adapters;
- `packages/web`: Next.js interface, Server Actions, APIs, and admin panel;
- `db`: PostgreSQL migrations and bootstrap;
- `docker-compose.full.yml`: PostgreSQL reference stack; optional integrations use explicit Compose overlays;
- `e2e`: browser end-to-end checks;
- `docs`: architecture and operations documentation.

PostgreSQL and SQLite are selectable persistence profiles. Realtime communicates
mutations and invalidations, but never replaces persistence or server-side ACL
checks. Administrative mutations enforce locks and `rowVersion`. The full
Compose stack is one deployment profile, not the only supported runtime.

Both profiles share the administrative bootstrap configured by
`SEED_ADMIN_EMAIL` and `SEED_ADMIN_PASSWORD`. Bootstrap is transactional,
additive, and idempotent: it initializes missing accounts, roles, permissions,
capabilities, and settings without deleting application data.

## Installation

For a complete, deployment-agnostic installation path—including standalone
SQLite, external PostgreSQL, optional integrations and operational
verification—read the [installation guide](docs/INSTALLATION.md).

## Quick start

The commands below start the repository's PostgreSQL reference/test profile.
They are not the only installation method and do not constitute a universal
production-ready deployment. For Node.js with SQLite or an external PostgreSQL,
start the Web application with the selected environment configuration and run
the applicable bootstrap/migrations independently. See the
[deployment model](docs/DEPLOYMENT_MODEL.md).

Create a protected `.env.docker` file with the required values and start the
base PostgreSQL reference profile:

```bash
docker compose --env-file .env.docker -f docker-compose.full.yml up -d --build
```

Realtime, antivirus, monitoring and backup are explicit optional profiles:

```bash
docker compose --env-file .env.docker \
  -f docker-compose.full.yml \
  -f docker-compose.realtime.yml \
  -f docker-compose.antivirus.yml \
  -f docker-compose.monitoring.yml \
  -f docker-compose.backup.yml up -d --build
```

Detailed ports, volumes, and configuration are documented in
[`docs/DOCKER_COMPOSE_FULL.md`](docs/DOCKER_COMPOSE_FULL.md).

## Verification

```bash
pnpm check
pnpm ops:health
```

`pnpm e2e` provisions its own isolated SQLite/PostgreSQL fixtures, temporary
Next.js servers, and realtime broker, then runs the complete browser gate.
It never targets the operational database. Focused commands remain available
when investigating one vertical:

```bash
pnpm e2e:admin-parity
pnpm e2e:canonical
pnpm e2e:parity
pnpm e2e:full
```

The canonical scenario configures types, enums, and relationships, creates a
user with a role and scope, verifies denial outside that scope, exercises locks
and `rowVersion` with two sessions, and checks deletion, restoration, and audit.

GitHub Actions runs reproducible installation, typecheck, lint, Core/Web tests,
and the production build. Separate jobs initialize isolated PostgreSQL 17
databases, verify migrations and the restricted application role, execute the
PostgreSQL integration/contract suite, and run `pnpm e2e:parity` with Chromium
against SQLite and PostgreSQL.

## Documentation

- [Architecture](ARCHITECTURE.md)
- [Product and deployment model](docs/DEPLOYMENT_MODEL.md)
- [Contributing](CONTRIBUTING.md)
- [Security policy](SECURITY.md)
- [Nodriva acceptance checklist](docs/NODRIVA_ACCEPTANCE_CHECKLIST.md)
- [Full Docker stack](docs/DOCKER_COMPOSE_FULL.md)
- [Administrative locks](docs/ADMIN_LOCKS.md)
- [Realtime mutation lifecycle](docs/REALTIME_MUTATION_LIFECYCLE.md)
- [Cache and frontend data flow](packages/web/src/app/cache/ARCHITECTURE.md)
- [Backup and restore](docs/BACKUP_RESTORE.md)
- [Encryption rotation](docs/ENCRYPTION_ROTATION.md)
- [Security operations](docs/SECURITY_OPERATIONS.md)
- [Documentation governance](docs/DOCUMENTATION_GOVERNANCE.md)
- [Service and deployment configuration](docs/SERVICE_CONFIGURATION_ARCHITECTURE.md)

## License

The code is distributed under the [Apache License 2.0](LICENSE). Third-party
dependencies retain their respective licenses. The product name and logo are
covered by the [name and logo policy](docs/TRADEMARK_POLICY.md).

## Project status

Nodriva is under active development. PostgreSQL is the primary complete profile;
SQLite provides standalone execution with Node.js and a local file. Runtime
providers, optional deployment profiles, disaster recovery, and other
enterprise capabilities remain deliberately incremental.

### Selectable persistence

```bash
DATABASE_ADAPTER=sqlite SQLITE_DATABASE_PATH=./data/nodriva.sqlite \
SEED_ADMIN_PASSWORD='change-me' pnpm --filter @dashboard/web build
```

The default remains PostgreSQL. SQLite uses `parent_id` and a closure table
instead of `ltree` while preserving application ports for transactions, ACLs,
locks, audit, revisions, types, sessions, encryption, and outbox behavior. The
default inactivity timeout is 1,800 seconds (30 minutes) in both profiles.
