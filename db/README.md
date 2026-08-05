# Database migrations

The canonical authentication table is `user_sessions`.

Apply migrations in filename order against a database initialized from
`Specifiche/dashboard_v4_schema_corrected.sql`. The first migration is also
safe for an existing database that still contains the legacy `sessions` table:
it stops if that table contains data, avoiding silent session loss.

The migration directory is intentionally kept separate from the specification
SQL. The specification describes the target schema; migrations describe how an
existing installation reaches it.

Migration `003_realtime_outbox_and_locks.sql` is idempotent. It aligns the
runtime `locks` table (including installations that still have
`resource_locks`) and creates the durable `realtime_event_outbox` used by the
post-commit delivery worker.

Migration `004_materialized_scope_node_path.sql` materializes each scope
assignment's `ltree` path and maintains it with triggers when assignments or
node paths change. It adds the GiST/index support used by ACL subtree queries.

Migration `005_administrative_identity_hardening.sql` adds the shared login
rate-limit store, one-time hashed invitation/password-reset tokens, and the
optional MFA TOTP enrollment store. It does not contain MFA secrets for any
user and is safe to apply before MFA is enabled in a deployment.

Migration `006_default_metadata_reader.sql` assigns every active identity the
baseline role used to read node/entity type metadata. It does not grant node or
entity data access, which remains governed by scoped assignments.

Migration `007_admin_role_permission_sync.sql` keeps the system `admin` role
aligned with permissions introduced after the initial seed. Concrete node and
entity operations remain constrained by their assigned scopes.

Migration `008_scope_assignment_audit_kind.sql` adds the audit resource kind
used when delegated scope assignments are revoked by lifecycle enforcement.
