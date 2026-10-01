# Development workflow

## Push gate

Before every push to a shared branch, the complete local verification gate is
mandatory:

```bash
pnpm verify:push
```

`pnpm verify:push` is the mandatory complete local verification gate and executes:

- source-documentation validation;
- Core and Web typecheck;
- Core and Web lint;
- Core and Web test suites;
- production builds for Core and Web.
- the complete PostgreSQL integration/contract/parity suite against an isolated
  local PostgreSQL test database (`pnpm test:postgres:local`);
- the browser parity E2E suite for SQLite and PostgreSQL (`pnpm e2e:parity`).

A push is not considered ready when any part of this command fails, even if
targeted tests, typecheck, lint, or one E2E scenario pass individually. The
PostgreSQL test database is created and destroyed locally by the dedicated test
script; operational and development databases are not used.

This document is the repository contract for the local push check. CI runs these checks in isolated jobs and additionally verifies realtime and
backup/restore. Before a release, run those operational checks locally too,
using isolated resources as described in `OPERATIONS_READINESS.md`.

## Additional checks in the isolated local database

`scripts/postgres-test-local.sh` accepts an optional command, executed only
after the PostgreSQL suite succeeds and before teardown. The command inherits
the test URLs and can verify restore or browser behavior in the same environment:

```bash
pnpm test:postgres:local bash /percorso/controlli-isolati.sh
```

The additional command does not replace the integration suite; its failure is
propagated and the temporary database is still removed. For browser checks,
pass connections and the test database name through
`PARITY_POSTGRES_ADMIN_URL`, `PARITY_POSTGRES_APP_URL` and
`PARITY_POSTGRES_TEMPLATE_DATABASE`; do not use the fallback that reads the
local deployment. `pnpm e2e:realtime` requires a test Soketi configured through
the existing Pusher variables and `REALTIME_WORKER_SECRET`. Do not enable
`PARITY_SKIP_BUILD` when switching profiles: public realtime variables are fixed
at build time.
