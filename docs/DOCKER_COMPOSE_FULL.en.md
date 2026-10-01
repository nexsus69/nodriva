# Reference Docker stack

[English](DOCKER_COMPOSE_FULL.en.md) | [Italiano](DOCKER_COMPOSE_FULL.md)

`docker-compose.full.yml` is a PostgreSQL reference/test profile for
development and staging, not an application requirement. The base file starts
persistence, migrations/bootstrap, Web and proxy; distributed integrations are
explicit Compose overlays. The same runtime configuration can point to remote
or provider-managed services. The general model is described in
[`SERVICE_CONFIGURATION_ARCHITECTURE.md`](./SERVICE_CONFIGURATION_ARCHITECTURE.en.md).

This profile deliberately includes local PostgreSQL and Caddy. It is not the
example for connecting an external PostgreSQL instance and is not proof of
production readiness. External PostgreSQL is supported through `DATABASE_URL`,
with migrations/bootstrap managed by the operator outside this Compose file.
Standalone SQLite starts with Node.js and does not use this Web image.

- `web`: production Next.js;
- `postgres`: PostgreSQL 17;
- `db-migrate`: base schema, migrations and restricted application role;
- `soketi` and `realtime-worker` (`docker-compose.realtime.yml`): Pusher broker
  and authenticated drain of realtime/workflow outbox;
- `clamav` (`docker-compose.antivirus.yml`): antivirus scanning;
- `prometheus` (`docker-compose.monitoring.yml`): metrics;
- `backup` (`docker-compose.backup.yml`): PostgreSQL backup and daily verified
  restore;
- `proxy`: Caddy for Web and, with realtime overlay, Soketi WebSocket traffic.

An absent overlay is intentional: Web neither waits for nor starts Soketi,
ClamAV, Prometheus or backup. The corresponding capability is `disabled` or
`unavailable` in the service catalogue, not a bootstrap error.

## Endpoints and ports

No address or port is hardcoded in the profile. Deployment declares external
bindings and internal topology through the variables below. PostgreSQL, ClamAV
and internal containers publish no external endpoint unless their profile is
explicitly configured.

## Configuration

Create `.env.docker` outside the repository or use a secret manager. The base
profile requires only PostgreSQL, authentication and encryption secrets, plus
public origin and Compose listening parameters:

```text
POSTGRES_PASSWORD=...
DASHBOARD_WEB_PASSWORD=...
NEXTAUTH_SECRET=...
ATTACHMENTS_ENCRYPTION_KEY=...
FIELD_ENCRYPTION_KEY=...
MFA_ENCRYPTION_KEY=...
DASHBOARD_PUBLIC_URL=https://dashboard.example.com
DASHBOARD_PUBLIC_HOST=dashboard.example.com
DASHBOARD_BIND_ADDRESS=...
DASHBOARD_WEB_BIND_ADDRESS=...
DASHBOARD_POSTGRES_PORT=...
DASHBOARD_POSTGRES_HOST=...
DASHBOARD_WEB_PORT=...
DASHBOARD_WEB_INTERNAL_HOST=...
DASHBOARD_WEB_INTERNAL_SCHEME=...
DASHBOARD_HTTP_PORT=...
DASHBOARD_HTTPS_PORT=...
CONTAINER_LOOPBACK_HOST=...
```

Nodriva neither reads nor requires Compose container names. Application
configuration variables describe an external or local provider and are
optional; `soketi` and `clamav` are only internal defaults of their Compose
profiles. Outside Compose, start Nodriva directly with the same application
variables pointing to deployment-selected DNS, managed services or processes.

Integration secrets and endpoints are required only when deployment enables the
capability and provider:

| Profile | Local Compose configuration | Remote/non-Docker equivalent |
|---|---|---|
| `realtime` | `NEXT_PUBLIC_REALTIME_ENABLED=true`, public Pusher key, `PUSHER_SECRET`, `REALTIME_WORKER_SECRET`, `REALTIME_INTERNAL_HOST`, `REALTIME_INTERNAL_PORT`, `REALTIME_INTERNAL_SCHEME` and browser public host. For the local container use `REALTIME_INTERNAL_HOST=soketi`. | managed Pusher/Soketi endpoint and separate worker with the same URLs and secrets |
| `antivirus` | `CLAMAV_HOST`, `CLAMAV_PORT`, `ATTACHMENTS_REQUIRE_SCAN=true` | remote ClamAV daemon; leave `CLAMAV_HOST` empty and capability disabled without one |
| `monitoring` | `PROMETHEUS_ENDPOINT` only when the endpoint should appear in the service catalogue | managed Prometheus/collector scraping Web |
| `backup` | `BACKUP_ROOT=/backups/postgres`, `BACKUP_STATUS_FILE=/backups/postgres/last-status.json`, retention | operator-selected scheduler/orchestrator job with protected storage and optional Web-readable manifest |

`DASHBOARD_PUBLIC_URL` is the canonical HTTPS origin for authentication,
account actions and healthcheck; `DASHBOARD_PUBLIC_HOST` is the hostname Caddy
uses for its certificate. They must describe the same public endpoint without a
container-internal port. `NEXT_PUBLIC_*` is public and must contain no secrets;
`PUSHER_SECRET` and the worker secret remain in the secret manager.

When realtime is enabled, `NEXT_PUBLIC_*` values are used during the Web image
build, so changing them requires rebuilding `web`. The reference explicitly
sets `DATABASE_ADAPTER=postgres`. `DASHBOARD_WEB_PASSWORD` may contain reserved
URL characters; the Web entrypoint encodes it before building the PostgreSQL
URI. Server-side realtime is governed by runtime capability `realtime`, while
`NEXT_PUBLIC_REALTIME_ENABLED` controls only client subscription.

`NEXT_PUBLIC_SESSION_IDLE_TIMEOUT_SECONDS` defaults to `1800` (30 minutes) both
as build argument and Web runtime. Heartbeat, polling and lock TTL derive from
this single value; changing it currently requires rebuilding the image.

## Startup

Base profile without optional services:

```bash
docker compose --env-file .env.docker -f docker-compose.full.yml up -d --build
```

Reference/test profile with all example integrations:

```bash
docker compose --env-file .env.docker \
  -f docker-compose.full.yml \
  -f docker-compose.realtime.yml \
  -f docker-compose.antivirus.yml \
  -f docker-compose.monitoring.yml \
  -f docker-compose.backup.yml up -d --build
```

One integration may be selected, for example by adding only
`-f docker-compose.antivirus.yml`. Enabling an overlay without its
configuration is a deployment error, not an implicit fallback to a local
container.

### Consistent overlay selection

Overlay choice belongs to deployment; starting every integration is not
required. After choosing it, use the same list of files for every Compose
command that observes or modifies the stack (`ps`, `logs`, `config`, `build`
and `up`). A command omitting an active overlay may report its services as
`orphan`; that message does not mean the service is unused or authorize its
removal.

For a deployment selecting all local integrations, define a reusable shell
array:

```bash
NODRIVA_COMPOSE_FILES=(
  -f docker-compose.full.yml
  -f docker-compose.realtime.yml
  -f docker-compose.antivirus.yml
  -f docker-compose.monitoring.yml
  -f docker-compose.backup.yml
)

docker compose --env-file .env.docker "${NODRIVA_COMPOSE_FILES[@]}" ps
docker compose --env-file .env.docker "${NODRIVA_COMPOSE_FILES[@]}" logs --tail=100 web
```

For a deployment changing only Web, keep the same selection but rebuild and
recreate only the affected service:

```bash
docker compose --env-file .env.docker "${NODRIVA_COMPOSE_FILES[@]}" build web
docker compose --env-file .env.docker "${NODRIVA_COMPOSE_FILES[@]}" up -d --no-deps web
```

Do not use `--remove-orphans` until removal of services excluded by the new
selection has been reviewed and approved.

The migrator exits successfully before Web starts. Verify:

```bash
docker compose --env-file .env.docker "${NODRIVA_COMPOSE_FILES[@]}" ps
curl https://dashboard.example.com/login
```

The realtime client must use the public hostname configured for Soketi. In the
reference, Caddy forwards `/app/*` to the Soketi container; outside Compose,
the proxy or selected realtime provider owns forwarding.

## Persistent volumes

- `dashboard_full_db_data`: database;
- `dashboard_full_attachments`: attachments;
- `dashboard_full_backups`: backups (`backup`); a read-only Web mount does not
  enable backup;
- `dashboard_full_clamav_db`: antivirus signature database (`antivirus`);
- `dashboard_full_prometheus`: metrics (`monitoring`);
- Caddy volumes: certificates and runtime configuration.

To replicate an installation on another machine, transfer data volumes and
secrets and verify a restore before starting Web. By default, application,
WebSocket and Prometheus are bound to the address declared by deployment.

With `monitoring`, Prometheus retains series for 30 days
(`PROMETHEUS_RETENTION_TIME`); deployment may change that value. Realtime and
workflow rules are evaluated locally; notifications require connecting
Prometheus to Alertmanager or another approved external alerting system.
