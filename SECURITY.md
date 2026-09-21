# Security policy

## Reporting a vulnerability

Do not open a public issue for a suspected vulnerability, credential exposure,
or security-sensitive configuration problem. Report it through the repository's
private GitHub security-advisory channel. If that channel is unavailable,
contact the repository maintainer privately through GitHub and include only the
minimum information needed to establish contact.

Provide a concise description, affected version or commit, reproduction steps,
impact, and any mitigations already applied. Do not attach production data,
passwords, private keys, access tokens, database dumps, or attachment payloads.

## Scope and response

The supported code line is the current `main` branch. Reports are triaged
without a service-level agreement. A confirmed issue is handled with a private
fix, regression test where feasible, and a coordinated disclosure note after a
safe update is available.

## Deployment operators

Operators are responsible for protecting deployment-specific secrets and
backups. Never commit `.env`, `.env.*`, private keys, database dumps, or backup
archives. The supported secret-reference and recovery procedures are described
in [Secret management](docs/SECRET_MANAGEMENT.md) and
[Backup and restore](docs/BACKUP_RESTORE.md).
