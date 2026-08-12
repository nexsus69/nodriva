# Dashboard Ultimate Web

Il frontend Next.js di Dashboard Ultimate contiene l’interfaccia operativa,
il pannello amministrativo, le Server Actions e gli endpoint HTTP.

La documentazione generale del progetto e le istruzioni per lo stack completo
sono nel [README principale](../../README.md). Per il flusso dati frontend
consultare [`src/app/cache/ARCHITECTURE.md`](src/app/cache/ARCHITECTURE.md).

## Sviluppo locale

Installare le dipendenze dalla root del monorepo:

```bash
pnpm install
pnpm --filter @dashboard/web dev
```

Per l’esecuzione replicabile con tutti i servizi usare `docker-compose.full.yml`.

Per il profilo standalone SQLite:

```bash
DATABASE_ADAPTER=sqlite SQLITE_DATABASE_PATH=./data/dashboard.sqlite SEED_ADMIN_PASSWORD='change-me' pnpm --filter @dashboard/web build
```

Il profilo PostgreSQL resta il default quando `DATABASE_ADAPTER` non è impostato.

## Verifiche

```bash
pnpm --filter @dashboard/web typecheck
pnpm --filter @dashboard/web lint
pnpm --filter @dashboard/web test
pnpm --filter @dashboard/web build
```

Le verifiche end-to-end sono gestite dalla configurazione Playwright nella
root e richiedono un ambiente autenticato. Il test amministrativo usa due
contesti Chromium e verifica lock, rilascio e propagazione realtime.
