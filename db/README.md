# Database migrations

The canonical authentication table is `user_sessions`.

Apply migrations in filename order against a database initialized from
`Specifiche/dashboard_v4_schema_corrected.sql`. The first migration is also
safe for an existing database that still contains the legacy `sessions` table:
it stops if that table contains data, avoiding silent session loss.

The migration directory is intentionally kept separate from the specification
SQL. The specification describes the target schema; migrations describe how an
existing installation reaches it.
