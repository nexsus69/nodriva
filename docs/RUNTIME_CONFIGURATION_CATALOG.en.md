# Runtime configuration and deployment catalogue

[English](RUNTIME_CONFIGURATION_CATALOG.en.md) | [Italiano](RUNTIME_CONFIGURATION_CATALOG.md)

This catalogue describes the target backend configuration model. The current
implementation is transitional: some capabilities already live in
`system_settings` or the environment; Core has a registry, resolver and
PostgreSQL repository for runtime values, and Web has an environment source
connected to the composition root. Some application providers still read
variables directly and real healthchecks are not yet connected. Classify every
new setting before adding it to `system_settings`, a deployment file or a
secret manager.

For the distinction between current and target state see
[`SERVICE_CONFIGURATION_ARCHITECTURE.md`](./SERVICE_CONFIGURATION_ARCHITECTURE.en.md).

## Classification rules

| Class | Persistence | Editable in panel | Examples |
| --- | --- | --- | --- |
| Runtime | `system_settings` | Yes, with authorization and audit | session timeout, UI limits, capabilities |
| Deployment | environment/Compose/orchestrator | No | Docker host, ports, internal URLs |
| Secret | secret manager/protected environment | No | passwords, keys, tokens, webhook secret |
| Derived | none of its own | No | heartbeat, polling, lock TTL |

Runtime configuration requires validation, default, limits, optimistic version
(`row_version`) and audit. Secrets must not be returned to the client.
Deployment configuration normally requires restart or redeploy and must not be
simulated as runtime Admin settings.

## Effective state of optional services

The executable `ServiceConfigurationRegistry` classifies every service as
`required` or `optional`, with dependencies, fallback and lifecycle (`hot`,
`process-restart`, `rebuild`, `redeploy`). An optional service without
deployment configuration resolves to explicit provider `disabled`: this is a
normal state, not a client error. Deployment provider values always take
precedence; runtime may change only policy for that same provider.

The authorized public view includes provider, state, fallback, lifecycle and
dependencies, never endpoint, path, port, secret or secret reference.

## Initial catalogue

### Session and security — runtime

- `session_idle_timeout_seconds`: maximum session inactivity;
- maximum active sessions per user;
- account-recovery token duration and limits;
- rate-limit attempt duration;
- MFA policy and tolerance window when configurable.

Heartbeat, polling, lock TTL, safety buffer and cache sweep derive from
`session_idle_timeout_seconds`; they are not independent keys.

### Capability and application behavior — runtime

- existing capabilities (`locking`, `entities_structure`,
  `hierarchical_structure`);
- pagination limits and maximum elements per request;
- maximum payload size;
- upload and attachment limits;
- audit retention and export mode;
- ordinary lock-activity recording without suppressing conflicts or
  administrative releases;
- any global functional policy.

### Realtime — mixed

Runtime:

- realtime enabled/disabled;
- worker operating intervals only when not derived and genuinely required;
- retry and backlog limits, with caution and audit.

Deployment:

- internal Pusher/Soketi host and port;
- realtime worker URL and drain endpoint;
- public endpoint used by the browser;
- app id, key, cluster and network scheme.

Secrets:

- Pusher/Soketi secret;
- `REALTIME_WORKER_SECRET`;
- transport authentication credentials.

An address such as `127.0.0.1` belongs to the process network context, not to a
value an administrator changes in the browser. Internal server-side and public
client-side endpoints must be distinct.

The target model adds provider, internal/public endpoint, port, scheme, timeout,
retry, healthcheck, dependencies and restart requirement.

### Database and infrastructure — deployment/secrets

- `DATABASE_URL` and PostgreSQL pool;
- ports, bindings and container DNS names;
- Compose profiles (`realtime`, `antivirus`, `monitoring`, `backup`), which are
  reference-deployment options, not implicit application capabilities;
- public application URLs;
- database secrets and service credentials.

These values remain outside `system_settings`. The persistence provider is
selected through `DATABASE_ADAPTER=postgres|sqlite`; every additional adapter
requires its own migrations, shared contract tests and parity E2E.

### Backup and recovery — deployment with read-only evidence

- backup provider is `postgres-dump` for PostgreSQL and `sqlite-snapshot` for
  SQLite; `BACKUP_ROOT` identifies only the operational backup context;
- `BACKUP_STATUS_FILE`, when deployment exposes it to Web, is an optional
  evidence source, not a runtime setting;
- public content is limited to provider, date, checksum, size, schema version,
  restore verification and coordinated attachment/keyring dependencies; path,
  filename, target, credentials and backup content stay hidden;
- without a reader, state is `unavailable`; starting backup and restore remain
  operational procedures outside the panel.

### External integrations — deployment/secrets

- webhook URLs and timeouts;
- SMTP or email provider;
- object storage and CDN;
- API credentials and keys;
- public callback and account-reset URLs.

Non-secret endpoints may be configured in deployment environment; tokens and
passwords must use a secret manager.

### Observability — mixed

Runtime:

- application logging level when policy permits;
- operational thresholds and non-sensitive metric retention.

Deployment:

- metrics endpoint;
- Prometheus targets;
- scrape credentials and secrets;
- tracing/exporter and related endpoints.

## Common service contract — target

Every service must describe at least:

| Aspect | Examples |
| --- | --- |
| Capability | enabled, disabled, required |
| Provider | PostgreSQL, SQLite, Soketi, Pusher, ClamAV, filesystem; S3 is only planned |
| Endpoint | host, port, scheme, database, bucket, path |
| Secret | external reference, never client value |
| Reliability | timeout, retry, backoff, pool, limits |
| Health | healthcheck, state, last verification |
| Lifecycle | hot reload, restart, redeploy |
| Dependencies | required services and permitted fallback |

## Minimum contract for every setting

Before implementation, every entry must specify:

1. key and category;
2. type and validation schema;
3. default, minimum and maximum;
4. authoritative origin;
5. runtime mutability;
6. required restart, if any;
7. client visibility and secret status;
8. required authorization and audit event;
9. impact on derived values and active sessions.

`session.idleTimeoutSeconds` already exists in seeds and is aligned to 1800
seconds by migration `033`. The temporary effective source shared by Web and
browser remains `NEXT_PUBLIC_SESSION_IDLE_TIMEOUT_SECONDS`; moving to an
authoritative runtime read without rebuild is still open work.
