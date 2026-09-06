# Development workflow

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
