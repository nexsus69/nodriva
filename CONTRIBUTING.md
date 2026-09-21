# Contributing to Nodriva

Thank you for contributing. Nodriva is a generic platform: changes must not
silently turn it into a product for one business domain.

## Before opening a pull request

1. Read [the architecture](ARCHITECTURE.md) and the applicable documents in
   `docs/`.
2. Keep domain, application, infrastructure, and web responsibilities
   separated. Backend authorization, locks, validation, and `rowVersion` are
   authoritative; UI and cache are not.
3. Preserve the observable contract of the PostgreSQL and SQLite profiles for
   common behaviour.
4. Add a focused regression or invariant test for every behavioural fix.
5. Do not commit credentials, `.env` files, database dumps, attachment
   payloads, or backup archives.

## Local verification

Run the checks relevant to the change before submitting it:

```bash
pnpm check
pnpm test:postgres:local
pnpm e2e:parity
```

Use only an isolated database whose name contains `test` for destructive
PostgreSQL checks. See the README and `docs/` for focused test and deployment
commands.

## Pull requests

Keep each pull request small and explain the user-visible intent, architecture
owner, tests run, PostgreSQL/SQLite impact, and any operational or documentation
change. Do not combine unrelated refactors with a behaviour change. CI must be
green before merge.
