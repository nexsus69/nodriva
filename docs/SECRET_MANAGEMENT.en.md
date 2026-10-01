# Secret management: Infisical example

[English](SECRET_MANAGEMENT.en.md) | [Italiano](SECRET_MANAGEMENT.md)

Self-hosted Infisical is an optional reference integration for a deployment
that chooses it, not a Nodriva requirement. The operator may use an equivalent
secret manager or protected mechanisms of the orchestrator. The example
instance is separate from the Dashboard stack; binding, public endpoint and
ports are declared through deployment `INFISICAL_*` variables.

## Bootstrap

1. Generate the secret file outside the repository with the repeatable script
   (it does not overwrite an existing file):

   ```bash
   ./scripts/infisical-init-env.sh
   ```

   Alternatively copy `.env.infisical.example` outside the repository, set
   passwords and randomly generated keys and apply mode `0600`.
2. Start the instance:

   ```bash
   docker compose --env-file .env.infisical -f docker-compose.infisical.yml up -d
   ```

3. Create the first administrator through an SSH tunnel:

   ```bash
   ssh -L "$INFISICAL_HOST_PORT:$INFISICAL_TUNNEL_HOST:$INFISICAL_PORT" <host>
   ```

   Then open `$INFISICAL_PUBLIC_URL` on the operator's computer.
4. Create a `nodriva` project, required environments and a machine identity with
   minimum read-only permissions for deployment.
5. Keep the machine-identity token outside the repository. It is the only
   deployment bootstrap secret and must be rotatable.

When this profile is adopted, the Infisical database and encryption key belong
to disaster recovery: coordinate their backup and never delete them without a
verified copy. Redis contains cache/job state and can be recreated.

## Verified Infisical backup

The optional `docker-compose.infisical-backup.yml` overlay creates a custom
PostgreSQL dump, checksum and restore in a database named
`infisical_restore_test_*`. Destination is the configurable mount
`INFISICAL_BACKUP_HOST_PATH`, which may be encrypted local storage, NAS or an
off-host replicated mount without coupling Nodriva to a storage provider. Start
it with the Infisical stack:

```bash
INFISICAL_BACKUP_HOST_PATH=/secure/backups/infisical \
docker compose --env-file .env.infisical \
  -f docker-compose.infisical.yml -f docker-compose.infisical-backup.yml up -d
```

`INFISICAL_ENCRYPTION_KEY` is never placed in the dump. Keep a separate,
encrypted recovery copy apart from the backup mount. Operational restore
requires both artifacts. Equivalent manual command is
`pnpm infisical:backup:verify` with deployment `INFISICAL_*` variables.

Dashboard does not query Infisical during user requests: deployment retrieves
secrets and supplies them to containers through protected files or Docker
secrets. Temporary Infisical unavailability therefore does not interrupt an
already started session.

## Export for deployment

After configuring secrets in the project, generate the runtime dotenv file
outside the repository:

```bash
NODRIVA_ENV_FILE="${XDG_CONFIG_HOME:-$HOME/.config}/nodriva/dashboard-production.env"
./scripts/infisical-export-env.sh \
  "$NODRIVA_ENV_FILE" \
  .env.docker
```

When the first argument is omitted, the script uses
`$HOME/.config/nodriva/dashboard-production.env`. Any protected path outside
the repository may be used. To use the generated file with the base Compose
profile:

```bash
docker compose --env-file "$NODRIVA_ENV_FILE" \
  -f docker-compose.full.yml up -d --build
```

Local integrations are explicit. For the complete reference add overlays
`-f docker-compose.realtime.yml`, `-f docker-compose.antivirus.yml`,
`-f docker-compose.monitoring.yml` and `-f docker-compose.backup.yml` according
to selected services. Pusher and worker secrets are not required when
`realtime` is disabled.

When realtime is disabled but attachments are used, add
`docker-compose.attachment-cleanup.yml`: the worker uses the same internal
secret and drains the durable queue of unreferenced payloads. Cleanup therefore
remains independent from realtime delivery.

The second argument contains non-secret operational configuration (bind address,
ports and intervals). Secrets present in that file are replaced with Infisical
values. Export uses a temporary token and never prints values. Repeat it after
secret rotation before the next deployment.
