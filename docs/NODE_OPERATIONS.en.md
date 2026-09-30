# Node.js operations: startup, upgrades and troubleshooting

[English](NODE_OPERATIONS.en.md) | [Italiano](NODE_OPERATIONS.md)

Reference runbook for installations without Docker, using SQLite or PostgreSQL.
Operating-system and process-manager configuration is outside Nodriva's scope.
Complete [INSTALLATION.en.md](INSTALLATION.en.md) and
[FIRST_RUN.en.md](FIRST_RUN.en.md) first.
For Docker, use [DOCKER_COMPOSE_FULL.md](DOCKER_COMPOSE_FULL.md).

## Application process requirements

The Web process requires Node.js 24, a built release with standalone assets and
dependencies, and the variables described in [INSTALLATION.en.md](INSTALLATION.en.md).
`HOSTNAME` and `PORT` determine the listening address and port; the local example
uses `127.0.0.1:3000`. Starting the Web does not start external databases, proxies
or workers.

The SQLite database and attachments must use persistent absolute paths writable
by the process; secrets must be accessible only to authorized parties. For
SQLite, keep the database and auxiliary files in the same directory and do not
share the same file across multiple Web replicas. Do not replace encryption
keys that are already in use. Logs may contain application metadata: do not
publish them in full.

Automatic startup, process restarts and log collection are deployment
responsibilities. This guide describes their application requirements, not
operating-system configuration.

## Proxy, HTTPS and integrations

Configure the chosen proxy to forward to the Web address, preserve the public
host and communicate the original HTTPS scheme. `NEXTAUTH_URL` must match the
actual public origin, not the backend address. Allow direct backend access
only from authorized entry points. For a local trial, do not expose the port
on all interfaces.

Check the certificate, redirects, login, cookies and application requests
through the proxy. If enabled, realtime also requires the WebSocket endpoint
to be published correctly and an authenticated worker; the broker alone is
not enough. See [REALTIME_MUTATION_LIFECYCLE.md](REALTIME_MUTATION_LIFECYCLE.md)
and [SERVICE_CONFIGURATION_ARCHITECTURE.md](SERVICE_CONFIGURATION_ARCHITECTURE.md).
Do not assume a provider is available just because its process is running.

## Controlled upgrade

1. Record the current version/commit, configuration and integrations. Read the
   new release notes, including migrations and format compatibility.
2. Build the new release in a separate directory, using dependencies from the
   lockfile and building Core before Web. Use isolated build secrets and
   databases; `NEXT_PUBLIC_*` values must nevertheless match the deployment's
   public configuration because they are embedded in the build. Do not build
   over the bundle served by the active process or ship test `.env` files.
3. Validate in isolation according to [RELEASE_CHECKLIST.md](RELEASE_CHECKLIST.md).
4. Agree on maintenance and stop Web and workers that write data. Create a
   coordinated database, attachment and key backup and verify restoration.
   Do not copy only the live SQLite file: use the snapshot tools documented
   in [BACKUP_RESTORE.md](BACKUP_RESTORE.md).
5. For PostgreSQL, apply missing migrations in filename order using a separate
   administrative identity, recording the applied files and results. **Do not
   reapply the base schema** during an upgrade. The project provides ordered
   SQL, not a universal schema rollback command. See [db/README.md](../db/README.md).
   For SQLite, schema evolution runs during adapter initialization: back up
   before starting the new version.
6. If the release requires it, rerun the additive bootstrap. Do not interpret
   this as a data or password reset.
7. Select the new release directory in the process manager or operator-managed
   link. Keep the previous release; start only the affected services with the
   correct operational environment.
8. Check HTTP, login, scope, attachments, audit and integrations; inspect logs
   and persistence after restart. Record results, duration and deployed version.

With Compose, keep the same overlay selection and rebuild/recreate only the
affected services, without `down --volumes` or unnecessary full-stack rebuilds.

## Rollback

If data, schema and formats remain compatible, select the previous bundle,
restart the affected services and repeat smoke tests. Checking out source code
while the server still uses another build is not sufficient.

If the release changed the schema or payload format, a code-only rollback may
not be enough. First restore the coordinated snapshot with the correct keys
in isolation and test it with the old release. An operational restore replaces
the current state and may lose changes made since the backup: it requires
explicit authorization and an agreed maintenance window. Do not generate new
keys to try to read old encrypted data.

## Quick troubleshooting

| Symptom | Safe check and response |
| --- | --- |
| Import `@dashboard/core` or `dist/index.js` not found | From the root, install using the lockfile and build Core before Web. Do not copy compiled files from another release. |
| SQLite cannot open / `EACCES` | Check the absolute path, existing directory, owner and Web account permissions; do not create a second database to hide the error. |
| Unstyled page or asset 404 | Check that `public` and `.next/static` were copied into the standalone bundle from the same build. |
| Initial PostgreSQL login fails | Check migrations, restricted role and explicit bootstrap; setting `SEED_ADMIN_*` in Web alone does not create the account. |
| New seed password does not work | The seed does not update an existing account. Use the current password or configured recovery, not a database reset. |
| PostgreSQL/TLS connection fails | Check DNS, network, percent-encoded password, database and trusted CA. Do not use a superuser or disable TLS as a workaround. |
| Login loops behind a proxy | Compare public origin, `NEXTAUTH_URL`, forwarded scheme, HTTPS and cookies; check consistent secrets across replicas. |
| Empty lists or access denied | Expected on a new installation; otherwise check role, scope and resource status with an administrator. Do not automatically broaden permissions. |
| Attachments cannot be read | Check mount, metadata, format and all keyring versions. Compare checksums on copies; never automatically convert/delete historical files. |
| No realtime | Check capability, build-time configuration, broker, worker and WebSocket. Without configuration, disabling it is intentional. |
| Invitations or recovery are not delivered | Check delivery provider, secret, endpoint and outbox handling. External SMTP configuration alone is not discovered automatically. |
| Backup unavailable in the panel | Check the scheduler and Web-readable `last-status.json`; check age and restore result, not only dump presence. |

If a check fails, retain the error with credentials and sensitive content
removed. Distinguish application denials from infrastructure failures; do not
disable authorization, locks, versions or encryption to work around the issue.
