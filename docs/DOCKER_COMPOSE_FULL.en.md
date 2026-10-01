# Reference Docker stack

`docker-compose.full.yml` is a PostgreSQL reference/test profile for
development and staging. It is not an application requirement or proof of
production readiness. The base profile starts persistence, migrations/bootstrap,
Web and proxy services; optional distributed integrations are explicit Compose
overlays.

An external PostgreSQL service is supported through `DATABASE_URL`, with
migrations and bootstrap operated separately. SQLite standalone runs with
Node.js and does not require this Web image. Review healthchecks, secrets,
backup and TLS configuration before using any deployment in production.
