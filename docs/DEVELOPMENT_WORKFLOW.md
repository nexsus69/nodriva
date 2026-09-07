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

`pnpm verify:push` is intentionally an alias of `pnpm check` and executes:

- source-documentation validation;
- Core and Web typecheck;
- Core and Web lint;
- Core and Web test suites;
- production builds for Core and Web.

A push is not considered ready when this command fails, even if targeted tests,
typecheck, lint, or an E2E scenario pass individually. PostgreSQL integration,
adapter parity, and required E2E suites remain additional CI gates when their
database/test environment is available.

This document is the repository contract for the local push check. CI runs the
same complete gate through `pnpm check`; the alias makes the required developer
action explicit and discoverable.
