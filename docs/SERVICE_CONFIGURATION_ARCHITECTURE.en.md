# Service and deployment configuration

[English](SERVICE_CONFIGURATION_ARCHITECTURE.en.md) | [Italiano](SERVICE_CONFIGURATION_ARCHITECTURE.md)

## Architectural goal

The application must run at different infrastructure levels. Application code
must not assume that Docker, PostgreSQL, Soketi, ClamAV, Prometheus or a proxy
are always present.

| Profile | Minimum requirements | Intended use |
| --- | --- | --- |
| Standalone | Node.js and a local persistence adapter | machine without administrable services |
| Distributed | Node.js, persistence and operator-selected local/remote services | deployment with separate services |
| Reference/test Compose | PostgreSQL, migrations/bootstrap, Web and proxy; explicit integration overlays | development, demonstration and repeatable tests |

The standalone profile uses the integrated SQLite adapter. Merely disabling
realtime or antivirus is not enough: the composition root still selects a
complete persistence profile.

## Current state

Currently:

- Domain and application services consume abstract ports/interfaces;
- PostgreSQL and SQLite are complete persistence profiles selected by the
  composition root and use different physical techniques behind the same ports;
- PostgreSQL uses `ltree`, JSONB, SQL locking and physical dynamic tables, while
  SQLite uses `parent_id`, closure tables, JSON payload and relational metadata;
- attachment storage is local to a filesystem or container volume;
- realtime and antivirus are configured mainly through environment/Compose;
- `docker-compose.full.yml` starts the base PostgreSQL reference;
  `docker-compose.realtime.yml`, `docker-compose.antivirus.yml`,
  `docker-compose.monitoring.yml` and `docker-compose.backup.yml` are optional
  overlays, not Web startup dependencies. The file is a development/staging
  example, not an application architecture requirement;
- a descriptive registry, application resolver, versioned PostgreSQL repository
  for runtime values and environment source connected to the Web composition
  root exist;
- the Web composition root resolves field, attachment and MFA encryption keys
  through `security-keys`; values remain deployment secrets and are not
  persisted in runtime configuration;
- some bootstrap values must be supplied before the application container:
  `DATABASE_URL` feeds the PostgreSQL provider and the PostgreSQL role policy is
  a startup guard;
- the application registry has concrete checkers for PostgreSQL, SQLite, Soketi
  and ClamAV connected to healthcheck; other providers remain `not-configured`
  until their adapter exists;
- SQLite includes schema, transaction root, closure table, nodes, JSON entities,
  types, ACL, locks, audit, revisions, outbox, users, sessions, rate limiting,
  account tokens, runtime configuration and dynamic-schema metadata; Web
  composition connects the selected profile to the same application services.

The PostgreSQL runtime accepts `DATABASE_URL` for an external instance. Supplied
Compose includes local PostgreSQL and no overlay to remove it; migrations,
bootstrap and restricted role for an external database belong to the operator.
Likewise, the supplied Web image has a PostgreSQL entrypoint; standalone SQLite
starts with Node.js.

Selection uses `DATABASE_ADAPTER=sqlite` and `SQLITE_DATABASE_PATH=...`; without
the first value PostgreSQL remains the default. Web build, standalone HTTP
startup and automated suites have been verified. Two isolated production
servers verify Admin parity and the common canonical vertical on SQLite and
PostgreSQL (`pnpm e2e:parity`).

Runtime configuration persistence is prepared by migration
`db/migrations/030_service_configurations.sql`; deployment and secrets remain
deliberately outside that table.

## Target state

Every infrastructure service will be selected and configured through an
adapter/provider without changing Domain:

```text
Application
 ├── PersistenceProvider
 ├── RealtimeProvider
 ├── AttachmentStorageProvider
 ├── AntivirusProvider
 ├── MailProvider
 ├── BackupProvider
 └── ObservabilityProvider
```

For every provider, capability, provider, endpoint, secret references, timeout,
retry, limits, healthcheck and restart requirement must be distinguishable. UI
may show status and non-sensitive endpoints, never passwords, private keys or
tokens.

## Implemented configuration and state contract

The registry describes provider, requirement (`required`/`optional`), fallback,
dependencies and lifecycle. Optional services without deployment appear as
`disabled`; database and attachment storage remain bootstrap requirements.
`ServiceConfigurationService` preserves precedence deployment → runtime →
derived and rejects a runtime provider different from deployment. The
`ServiceAdministrationApplicationService` exposes a redacted catalogue,
non-mutating healthchecks and, through optional `BackupStatusPort`, sanitized
backup evidence behind `system.config.read`. The port only reads the operational
manifest; it does not perform backup or restore. A deployment without a reader
returns explicit `unavailable`.

In standalone mode, `attachment-storage` is explicitly bootstrapped as a
filesystem at `./.data/attachments` when `ATTACHMENTS_ROOT` is undefined; it is
no longer an invisible fallback of only the local adapter.

**Platform → Integrations**, **Data & recovery** and **Health & observability**
are intentionally read-only for deployment and secrets. Views show sanitized
provider, state, fallback, dependencies and lifecycle; Data & recovery also
shows sanitized verified-backup manifest when deployment supplies it. They do
not modify environment, endpoints, passwords or secrets. S3-compatible storage
and SMTP remain planned until adapters, healthchecks and contract tests exist.

## Classification

1. **Runtime:** functional settings editable with authorization, validation,
   version and audit.
2. **Deployment:** addresses, ports, provider and topology defined at startup
   or by the orchestrator.
3. **Secret:** passwords, keys and tokens held by protected environment, Docker
   secrets, Vault, KMS or equivalent manager.
4. **Derived:** values calculated from authoritative configuration.

## Persistence adapters

SQLite implements the same main application contracts as PostgreSQL: ACL,
hierarchy, transactions, locks, `rowVersion`, audit, soft delete, pagination,
field encryption and outbox. Its hierarchy uses a closure table
(`ancestor_id`, `descendant_id`, `depth`) instead of PostgreSQL `ltree`.

Shared contract tests, Admin E2E and canonical E2E verify observable parity,
including scoped ACL, session locks, optimistic concurrency, relationships and
delete/restore lifecycle. Adapter-specific tests remain necessary for native
semantics that cannot be identical, especially concurrent outbox claims and
PostgreSQL physical DDL.
