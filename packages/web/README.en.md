# Nodriva Web

The Nodriva Next.js frontend contains the operational interface, administrative
panel, Server Actions and HTTP endpoints.

General project documentation and complete-stack instructions are in the
[main README](../../README.md). For frontend data flow see
[`src/app/cache/ARCHITECTURE.md`](src/app/cache/ARCHITECTURE.md).

## Local development

Install dependencies from the monorepo root:

```bash
pnpm install
pnpm --filter @dashboard/web dev
```

For repeatable execution with all services use `docker-compose.full.yml`.

For standalone SQLite:

```bash
DATABASE_ADAPTER=sqlite SQLITE_DATABASE_PATH=./data/dashboard.sqlite SEED_ADMIN_PASSWORD='change-me' pnpm --filter @dashboard/web build
```

PostgreSQL remains the default when `DATABASE_ADAPTER` is not set.

## Verification

```bash
pnpm --filter @dashboard/web typecheck
pnpm --filter @dashboard/web lint
pnpm --filter @dashboard/web test
pnpm --filter @dashboard/web build
```

End-to-end checks are managed by the Playwright configuration in the repository
root and require an authenticated environment. To compare the complete Admin
panel on both adapters, run from the root:

```bash
pnpm e2e:admin-parity
```

The script prepares isolated data in SQLite and a PostgreSQL test database,
starts two production servers and compares sections, creation, details and
audit. The general E2E suite separately covers concurrent locks and realtime.
