# Release checklist

[English](RELEASE_CHECKLIST.en.md) | [Italiano](RELEASE_CHECKLIST.md)

## Automated checks

- [ ] CI is green on the release commit.
- [ ] PostgreSQL has been initialized from zero, migrations and legacy upgrade
      verified, restricted role checked, and integration/parity tests run without
      configuration skips.
- [ ] `pnpm install --frozen-lockfile` leaves the lockfile unchanged.
- [ ] `pnpm check` completes typecheck, lint, tests and production builds.
- [ ] No local changes or secret files are included in the commit.
- [ ] Release notes describe migrations, breaking changes and new variables.

## Isolated environment

- [ ] PostgreSQL test database name contains `test` and is disposable.
- [ ] Authenticated E2E runs with temporary users and data.
- [ ] Admin parity, canonical vertical and SQLite profile are verified when
      supported by the release.
- [ ] Login, ACL, scopes, denial, lock contention, `rowVersion`, realtime and
      direct unauthorized access are checked.
- [ ] Attachment upload/download/scanning/encryption/deletion are checked when
      enabled; realtime-disabled behavior is checked as well.

## Data and security

- [ ] PostgreSQL backup restores into a disposable database.
- [ ] Attachment payload archive is coordinated with the database dump.
- [ ] Encryption keys are present in the secret manager and outside Git.
- [ ] Migrations, upgrade path and restricted role are verified.
- [ ] HTTPS, cookies, proxy and WebSocket policy are checked outside localhost.
- [ ] Retention, alerts, logs and metrics are defined.
- [ ] No test locks remain.

## Deployment and rollback

- [ ] Release image or bundle is identified immutably.
- [ ] Persistent volumes and secrets are part of the recovery plan.
- [ ] Rollback compatibility is tested or explicitly assessed.
- [ ] Maintenance window and responsible operator are recorded.
- [ ] After deployment, health, login, navigation, controlled mutation and
      realtime metrics are checked.
