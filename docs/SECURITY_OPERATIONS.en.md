# Security operations

[English](SECURITY_OPERATIONS.en.md) | [Italiano](SECURITY_OPERATIONS.md)

Keep authentication secrets, encryption keys, database credentials, webhook
secrets and backup archives outside Git and restrict access to authorized
operators. Use separate values per environment and retain old encryption key
versions until every backup and rotation verification is complete.

Web must use a restricted PostgreSQL role, never a superuser. Backend ACL,
scope, lock, `rowVersion`, validation and deletion policies are authoritative.
Do not expose secret references, endpoints or topology in the Admin panel.

Use HTTPS, secure cookie/proxy configuration, least-privilege providers,
isolated test databases and sanitized logs. Verify backups by restoring to a
disposable database, coordinate attachment bytes and keys, monitor health and
backup age, and document operator access and retention.
