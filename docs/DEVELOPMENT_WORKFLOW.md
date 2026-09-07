# Development workflow

## Piano obbligatorio prima del codice

Per ogni intervento non banale il piano viene scritto e concordato prima di
modificare il repository. Deve indicare obiettivo, perimetro, file o moduli
coinvolti, strategia, test, rischi e criteri di chiusura. Senza conferma
esplicita del piano si possono fare solo analisi read-only e raccolta di
evidenze. Se il perimetro cambia, il piano viene aggiornato e riconfermato
prima di continuare.

Questa regola è versionata qui e in `docs/ARCHITECTURAL_GOVERNANCE.md`, quindi
resta applicabile anche dopo una pulizia della cache o l'avvio di una nuova
sessione di lavoro.

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

This document is the repository contract for the local push check. CI runs the
equivalent checks in isolated jobs; the local gate is intentionally no weaker
than CI for PostgreSQL, adapter parity and browser parity.
