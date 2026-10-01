# Database migrations

[English](README.en.md) | [Italiano](README.md)

Apply migrations in filename order to a database initialized from
`Specifiche/dashboard_v4_schema_corrected.sql`. Schema and migrations alone do
not create the first administrator; complete the explicit `SystemSeedPostgres`
bootstrap in [the installation guide](../docs/INSTALLATION.en.md) first.
Compose performs it through `db-seed`; neither path loads demo content.

The canonical authentication table is `user_sessions`. Migration `009` converts
legacy tokens, installs the restricted `dashboard_app` group and removes the old
table. Create a dedicated LOGIN role in that group and set
`REQUIRE_RESTRICTED_DB_ROLE=true`; Web must never connect as `postgres`.

Migration `020` removes generic schema DDL from the application role and exposes
only controlled `SECURITY DEFINER` functions. Later migrations add relationship
metadata, dynamic tables, recycle-bin permissions, realtime capabilities,
encryption rotation, service configuration and attachment rate limiting.
Never rerun the base schema during an upgrade; apply only missing migrations.

The integration bootstrap uses an empty database whose name contains `test`,
verifies the legacy upgrade, reapplies migrations and checks the restricted
role. It is destructive only for that disposable database.
