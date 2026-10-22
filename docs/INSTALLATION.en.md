# Installation guide

[English](INSTALLATION.en.md) | [Italiano](INSTALLATION.md)

This guide installs Nodriva without assuming Docker, a cloud provider or a
particular orchestrator. Docker Compose is an optional reference profile,
not an application requirement.

Path: prerequisites → one database profile → build and startup → verification
→ [first run](FIRST_RUN.en.md). For process requirements, upgrades and
troubleshooting, see the [Node.js runbook](NODE_OPERATIONS.en.md). Shell examples
start at the repository root unless stated otherwise; they are not resets.

## 1. Choose a profile

| Profile | When to use it | Mandatory requirements |
| --- | --- | --- |
| Standalone SQLite | single local instance or small self-contained environment | Node.js, persistent SQLite file, persistent attachment filesystem |
| PostgreSQL | complete or distributed installation | Node.js, managed PostgreSQL, restricted application role, attachment storage |
| Reference Compose | development, demos or reproducible verification | Docker and `.env.docker` configuration |

SQLite and PostgreSQL share application behavior. Realtime, antivirus, scheduled
backups, metrics and account-action delivery are optional integrations: enable
them only when their deployment has been configured and verified.

### What a new installation contains

A new database receives the schema, initial administrator, roles, permissions,
settings and technical catalogues. **No demo nodes, entities, attachments or
application types are created.** Configure types and content after the first
login. This applies to both adapters.

Reusing an existing SQLite file, PostgreSQL database or Docker volume preserves
data: reinstallation and bootstrap do not empty the environment. For a second
clean installation, prepare separate storage and a separate database; do not
delete the current ones. E2E fixtures are not an installer and must not run
against operational data.

## 2. Common prerequisites

- Node.js 24 and Corepack;
- a persistent, non-public directory for data and attachments;
- a public HTTPS URL for a deployment accessible to users;
- different secrets for each environment, never stored in the repository.

Start from a checkout of the selected release and record its commit. The pnpm
version is pinned by `packageManager` in `package.json`: use that version and
do not update the lockfile during installation. The PostgreSQL examples are
verified on the PostgreSQL 17 profile; compatible `psql`, `pg_dump` and
`pg_restore` clients are also required.

Install dependencies from the repository root:

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm --filter @dashboard/core build
```

Copy `.env.example` to a protected file outside the repository, such as
`/etc/nodriva/nodriva.env`, replace every placeholder and restrict permissions
to the account running the process.

If loaded with `.`, the file must be shell-compatible: quote values containing
special characters. Do not use `set -x` or print the environment in logs. The
copied file is a template, not a ready-to-use configuration. Use **absolute**
paths for data and attachments: the working directory changes between the CLI,
standalone server and process manager.

The common required variables are:

```text
NEXTAUTH_URL=https://nodriva.example.test
NEXTAUTH_SECRET=<at least 32 random characters>
SEED_ADMIN_EMAIL=admin@example.test
SEED_ADMIN_PASSWORD=<strong initial password>
ATTACHMENTS_ROOT=/srv/nodriva/attachments
ATTACHMENTS_REQUIRE_ENCRYPTION=true
ATTACHMENTS_ENCRYPTION_KEY=<64 random hexadecimal characters>
FIELD_ENCRYPTION_KEY=<64 random hexadecimal characters>
MFA_ENCRYPTION_KEY=<32 random bytes encoded as base64>
NEXT_PUBLIC_REALTIME_ENABLED=false
ATTACHMENTS_REQUIRE_SCAN=false
```

Administrator bootstrap is additive and idempotent: it does not delete existing
data. Encryption keys must be retained and backed up with the data; losing them
makes encrypted values unrecoverable.

Generate independent values using `openssl rand -hex 32` for the auth secret
and hex keys, or `openssl rand -base64 32` for MFA, in a private terminal without
output recording. Transfer them to the secret manager/protected file. Do not
regenerate them on every restart; retain the versions needed by backups,
separately from encrypted archives.

For a local trial, use `NEXTAUTH_URL=http://127.0.0.1:3000` and loopback binding.
For remote access, prepare DNS, a certificate and an HTTPS proxy before exposing
the service. Always adapt example hostnames.

### Main application variables

These variables are read by the Web process. The orchestrator may add its own
ports, hostnames, logging and resource limits: those are not part of Nodriva's
application contract.

| Group | Variables | Required when | Notes |
| --- | --- | --- | --- |
| Startup and authentication | `NEXTAUTH_URL`, `NEXTAUTH_SECRET`; `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD` for bootstrap | authentication; initial identity during bootstrap | the seed does not reset an existing user's password |
| Session | `NEXT_PUBLIC_SESSION_IDLE_TIMEOUT_SECONDS` | optional, default 1800 seconds | shared timing policy; changes require a rebuild |
| SQLite | `DATABASE_ADAPTER=sqlite`, `SQLITE_DATABASE_PATH` | standalone profile | the path must be on persistent storage |
| PostgreSQL | `DATABASE_ADAPTER=postgres`, `DATABASE_URL`, `REQUIRE_RESTRICTED_DB_ROLE=true` | PostgreSQL profile | the login in the URL must belong to `dashboard_app` and must not be a superuser |
| Attachments | `ATTACHMENTS_ROOT`, `ATTACHMENTS_REQUIRE_ENCRYPTION` | whenever attachments are used | persistent, non-public filesystem |
| Encryption | `FIELD_ENCRYPTION_KEY`, `ATTACHMENTS_ENCRYPTION_KEY`, `MFA_ENCRYPTION_KEY` | always in the current profile | `*_KEYS` and `*_ACTIVE_VERSION` variants support rotation; see `ENCRYPTION_ROTATION.md` |
| Realtime | `NEXT_PUBLIC_REALTIME_ENABLED`, `NEXT_PUBLIC_PUSHER_KEY`, `NEXT_PUBLIC_PUSHER_CLUSTER`, `NEXT_PUBLIC_PUSHER_HOST`, `NEXT_PUBLIC_PUSHER_PORT`, `NEXT_PUBLIC_PUSHER_SCHEME`, `PUSHER_APP_ID`, `PUSHER_SECRET`, `REALTIME_INTERNAL_HOST`, `REALTIME_INTERNAL_PORT`, `REALTIME_INTERNAL_SCHEME`, `REALTIME_WORKER_SECRET` | realtime enabled | `NEXT_PUBLIC_*` values are embedded in the Web build; rebuild after changes |
| Antivirus | `CLAMAV_HOST`, `CLAMAV_PORT`, `CLAMAV_TIMEOUT_MS`, `ATTACHMENTS_REQUIRE_SCAN` | attachment scanning enabled | absence of `CLAMAV_HOST` disables the provider |
| Account actions | `ACCOUNT_ACTION_DELIVERY_WEBHOOK_URL`, `ACCOUNT_ACTION_DELIVERY_WEBHOOK_SECRET`, `ACCOUNT_ACTION_DELIVERY_TIMEOUT_MS`, `ACCOUNT_ACTION_PUBLIC_BASE_URL` | invitations, password recovery or external delivery enabled | the public URL may match `NEXTAUTH_URL` |
| Backup | `BACKUP_ROOT`, `BACKUP_STATUS_FILE` | backup evidence in the UI | Web must be able to read the manifest, not backup contents |
| Observability | `PROMETHEUS_ENDPOINT` | endpoint exposed in the administrative catalogue | the collector may be local or remote |

Supported rotation keys are `FIELD_ENCRYPTION_KEYS`,
`FIELD_ENCRYPTION_ACTIVE_VERSION`, `ATTACHMENTS_ENCRYPTION_KEYS`,
`ATTACHMENTS_ENCRYPTION_ACTIVE_VERSION`, `ACCOUNT_ACTION_ENCRYPTION_KEY`,
`ACCOUNT_ACTION_ENCRYPTION_KEYS` and `ACCOUNT_ACTION_ENCRYPTION_ACTIVE_VERSION`.
These are deployment secrets and must not appear in the panel, repository or
logs. The complete normative catalogue is in
[RUNTIME_CONFIGURATION_CATALOG.md](RUNTIME_CONFIGURATION_CATALOG.md).

## 3. Standalone SQLite

Set these values in the environment file:

```text
DATABASE_ADAPTER=sqlite
SQLITE_DATABASE_PATH=/srv/nodriva/data/nodriva.sqlite
```

The data and attachment directories must exist, be persistent and writable by
the Web process, and not be publicly accessible. Preparing them and configuring
operating-system accounts are deployment responsibilities.

Start Web with the selected environment. The example uses a POSIX shell; a
process manager, Kubernetes or another orchestrator must pass the same variables
without writing them to logs.

```bash
set -eu
set -a
. /etc/nodriva/nodriva.env
set +a
pnpm --filter @dashboard/core build
pnpm --filter @dashboard/web build
mkdir -p packages/web/.next/standalone/packages/web/.next/static
mkdir -p packages/web/.next/standalone/packages/web/public
cp -a packages/web/.next/static/. packages/web/.next/standalone/packages/web/.next/static/
cp -a packages/web/public/. packages/web/.next/standalone/packages/web/public/
HOSTNAME=127.0.0.1 PORT=3000 node packages/web/.next/standalone/packages/web/server.js
```

On first startup, Nodriva creates the SQLite schema and administrative bootstrap.
Realtime and antivirus normally remain disabled in this profile.

Build and start as an authorized account, not root. The repository uses
`output: 'standalone'`: the generated server is the production path documented
here; also copy static assets and `public`, as the Docker image does. The command
stays in the foreground; process management is a deployment responsibility.
Application requirements are in [NODE_OPERATIONS.en.md](NODE_OPERATIONS.en.md).
The build loads server modules: use only the selected environment, not an
operational SQLite file for a trial build.

## 4. External PostgreSQL

Create an empty database and a temporary administrative identity separate from
the application's identity. The database must support `pgcrypto` and `ltree`.

Initialize the base schema and apply all migrations in lexicographic order
using only the administrative identity. Example:

```bash
set -eu
psql "$NODRIVA_POSTGRES_ADMIN_URL" -v ON_ERROR_STOP=1 \
  -f db/schema/001_baseline_schema.sql
for migration in db/migrations/*.sql; do
  psql "$NODRIVA_POSTGRES_ADMIN_URL" -v ON_ERROR_STOP=1 -f "$migration"
done
```

`NODRIVA_POSTGRES_ADMIN_URL` is an operator variable supplied through the chosen
secret flow; it is not Web configuration. Do not run the base schema on a
populated database. Errors stop the sequence: do not start the application until
migrations and checks are complete.

Follow [db/README.md](../db/README.md) for `dashboard_app`, the dedicated login
and restricted-role constraints. Web must never use `postgres`, a superuser or
an identity with generic DDL privileges.

Then set:

```text
DATABASE_ADAPTER=postgres
DATABASE_URL=postgresql://dashboard_web:<secret>@db.example.test:5432/nodriva?sslmode=require
REQUIRE_RESTRICTED_DB_ROLE=true
```

The password in the URI must be percent-encoded if it contains characters such
as `@`, `/` or `#`. For private TLS, provide the trusted CA to Node, for example
through `NODE_EXTRA_CA_CERTS`; do not disable TLS verification.

### Administrative bootstrap outside Docker

The SQL schema does not create the initial user, and PostgreSQL Web does not
run the seed automatically. With the application environment loaded and Core
built, run this command from the root. It uses the same authoritative service
as Compose, with the restricted application login in `DATABASE_URL`.

```bash
set -eu
set -a
. /etc/nodriva/nodriva.env
set +a
pnpm --filter @dashboard/core build
pnpm --filter @dashboard/core exec node --input-type=module <<'NODE'
import pg from 'pg';
import { PgExecutor, TransactionPortPostgres, SystemSeedPostgres } from './dist/index.js';
if (process.env.DATABASE_ADAPTER !== 'postgres' || !process.env.DATABASE_URL
    || !process.env.SEED_ADMIN_EMAIL || !process.env.SEED_ADMIN_PASSWORD) {
  throw new Error('Configure PostgreSQL profile, DATABASE_URL and seed credentials');
}
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
try {
  const seed = new SystemSeedPostgres(
    new PgExecutor(pool), new TransactionPortPostgres(pool),
    process.env.SEED_ADMIN_PASSWORD, process.env.SEED_ADMIN_EMAIL,
  );
  await seed.seedDatabase();
  if (!await seed.checkSeeded()) throw new Error('Incomplete bootstrap');
  console.log('Administrative bootstrap completed');
} finally {
  await pool.end();
}
NODE
```

Success means the catalogue is initialized, not that demo data was loaded.
Bootstrap does not change an existing account's password or replace migrations.
Do not try to create the first identity from the panel: its UI action already
requires an authenticated superadmin.

Build and start Web with the commands in the SQLite section, but keep
`DATABASE_ADAPTER=postgres` and its environment. PostgreSQL also requires a
persistent attachment directory writable by the Web account. Migrations and
bootstrap must finish before Web accepts traffic.

## 5. Optional integrations

A running service does not automatically enable a capability: the integration
must be declared explicitly to the Web process.

| Function | Minimum Web configuration | Behavior without configuration |
| --- | --- | --- |
| Realtime | `NEXT_PUBLIC_REALTIME_ENABLED=true`, Pusher/Soketi parameters and worker secret | disabled |
| Antivirus | `CLAMAV_HOST`, `CLAMAV_PORT`, `ATTACHMENTS_REQUIRE_SCAN=true` | disabled |
| Account-action delivery | `ACCOUNT_ACTION_DELIVERY_WEBHOOK_URL` and its secret when needed | disabled |
| Metrics/observability | `PROMETHEUS_ENDPOINT` | not configured in the administrative catalogue |
| Backup evidence in the UI | `BACKUP_ROOT` and Web-readable `BACKUP_STATUS_FILE` | “Status unavailable” |

The process generating backup dumps/snapshots belongs to the scheduler, managed
provider or orchestrator selected by the operator. To display the outcome in Nodriva, it must write
a compatible `last-status.json` manifest and make only that file readable by
Web. Web does not create, modify or expose the backup. See
[BACKUP_OPERATIONS.md](BACKUP_OPERATIONS.md) and [BACKUP_RESTORE.md](BACKUP_RESTORE.md).

## 6. Post-installation verification

Before exposing the instance to users, check the running process:

```bash
curl --fail --silent --show-error --output /dev/null http://127.0.0.1:3000/login
curl --fail --silent --show-error --output /dev/null https://nodriva.example.test/login
```

Adapt the port and URL; the second check applies to HTTPS deployments. A correct
HTTP response does not prove login, database or authorization: complete
[FIRST_RUN.en.md](FIRST_RUN.en.md), check persistence after restart, attachments
and configured integrations. For Compose also use
[OPERATIONS_READINESS.md](OPERATIONS_READINESS.md), which is specific to that profile.

Release typecheck, lint, tests and build (`pnpm check`, integrations and E2E)
run in CI or an isolated environment according to
[RELEASE_CHECKLIST.md](RELEASE_CHECKLIST.md), not with operational credentials,
files or databases. A green suite is not a verified installation.

## 7. Compose as an optional example

The PostgreSQL reference profile is described in
[DOCKER_COMPOSE_FULL.md](DOCKER_COMPOSE_FULL.md). Use it only after filling in
a protected `.env.docker`; explicitly choose the realtime, antivirus, monitoring
and backup overlays needed by the deployment.

## References

- [Deployment model](DEPLOYMENT_MODEL.md)
- [Runtime and deployment configuration catalogue](RUNTIME_CONFIGURATION_CATALOG.md)
- [Security operations](SECURITY_OPERATIONS.md)
- [Backup and restore](BACKUP_RESTORE.md)
- [First login and initial setup](FIRST_RUN.en.md)
- [Operational requirements, upgrades and Node.js troubleshooting](NODE_OPERATIONS.en.md)
