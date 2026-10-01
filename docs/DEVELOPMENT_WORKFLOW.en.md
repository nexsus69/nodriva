# Development workflow

[English](DEVELOPMENT_WORKFLOW.en.md) | [Italiano](DEVELOPMENT_WORKFLOW.md)

Before every push to a shared branch, run:

```bash
pnpm verify:push
```

This gate covers documentation, typecheck, lint, Core/Web tests and production
builds, then PostgreSQL integration/contract/parity against an isolated database
and browser parity for SQLite/PostgreSQL. The PostgreSQL database is created and
destroyed by the dedicated script; operational databases are never used.

Optional checks may run after the PostgreSQL suite and before teardown, sharing
only its isolated URLs. Realtime E2E needs an isolated Soketi and worker secret.
Do not skip the build when changing public realtime variables: those values are
embedded in the Web bundle. A push is not ready when any gate is skipped because
of missing configuration.
