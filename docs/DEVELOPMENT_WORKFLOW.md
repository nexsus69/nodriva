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

## Controlli aggiuntivi nel database locale isolato

`scripts/postgres-test-local.sh` accetta un comando opzionale, eseguito solo
dopo il successo della suite PostgreSQL e prima del teardown. Il comando
eredita le URL di test e può verificare restore o browser nello stesso ambiente:

```bash
pnpm test:postgres:local bash /percorso/controlli-isolati.sh
```

Il comando aggiuntivo non sostituisce le integrazioni; un suo errore si propaga
e il database temporaneo viene comunque eliminato. Per i browser passare a
`PARITY_POSTGRES_ADMIN_URL`, `PARITY_POSTGRES_APP_URL` e
`PARITY_POSTGRES_TEMPLATE_DATABASE` le connessioni e il nome del database di
test; non usare il fallback che legge il deployment locale. `pnpm e2e:realtime`
richiede un Soketi di test configurato tramite le variabili Pusher esistenti,
più `REALTIME_WORKER_SECRET`. Non abilitare `PARITY_SKIP_BUILD` passando da un
profilo all'altro: le variabili pubbliche realtime sono fissate dalla build.
