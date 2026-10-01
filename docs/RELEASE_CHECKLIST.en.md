# Release checklist

[English](RELEASE_CHECKLIST.en.md) | [Italiano](RELEASE_CHECKLIST.md)

This checklist distinguishes automatically verified items from those requiring
a controlled environment. A release must not use development databases,
attachments or secrets.

## Automated checks

- [ ] Project CI is green on the commit to release.
- [ ] The PostgreSQL job applied schema and migrations from an empty database,
      converted the legacy fixture, reapplied migrations, verified the
      restricted role and ran integration and adapter parity without skips.
- [ ] `pnpm install --frozen-lockfile` completes without changing the lockfile.
- [ ] `pnpm check` completes typecheck, lint, tests and production build.
- [ ] No local changes or secret files are included in the commit.
- [ ] Changelog or release notes describe migrations, breaking changes and new
      variables.

## Isolated-environment checks

- [ ] PostgreSQL test instance initialized from current schema and migrations.
- [ ] PostgreSQL integration suite ran against a dedicated `*_test` database.
- [ ] Authenticated E2E ran with temporary users and data.
- [ ] `pnpm e2e:admin-parity` ran: sections, mutations, details and Admin audit
      are equivalent on SQLite and PostgreSQL.
- [ ] `pnpm e2e:canonical` ran: dynamic schema, scope, two sessions, locks,
      `rowVersion`, relationships, delete/restore and audit are equivalent; or
      `pnpm e2e:parity` ran both scenarios.
- [ ] Login, ACL, `self`/`subtree` scope, deny, concurrent locks, realtime
      revocation and unauthorized direct access were verified.
- [ ] Upload, download, antivirus, encryption and attachment removal were
      verified when capabilities are enabled by deployment.
- [ ] Behavior with realtime disabled was verified.
- [ ] Standalone SQLite profile was verified when the release declares support.

## Database, data and security

- [ ] PostgreSQL backup created and restored successfully in a temporary
      database.
- [ ] When attachments are enabled, attachment-volume copy and restore were
      coordinated with the PostgreSQL dump and verified on real payloads.
- [ ] Encryption keys are present in the secret manager and absent from versioned
      files.
- [ ] Migrations were applied in order; upgrade path and reapplication were
      verified; restricted application role was verified.
- [ ] HTTPS, cookie, proxy and WebSocket policies were verified outside local
      development.
- [ ] Audit, backup, log and metric retention are defined for deployment.
- [ ] No test-created lock remains active.

## Deployment and rollback

- [ ] Release image is identified by an immutable digest.
- [ ] Persistent volumes and secrets are included in the recovery plan.
- [ ] Rollback procedure was exercised or at least verified against the same
      schema.
- [ ] Responsible operator and maintenance window are recorded.
- [ ] After deployment, healthcheck, login, navigation, controlled mutation and
      realtime metrics are verified.

## Repository status

The CI workflow covers the automated path. This checklist does not make a
deployment production-ready automatically: modular Compose, secret manager,
HTTPS, replication, retention and disaster recovery remain responsibilities of
the operating environment. Each run must record outcomes in the release system
chosen by the operator, not in this versioned checklist.
