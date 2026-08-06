# Database migrations

The canonical authentication table is `user_sessions`.

Apply migrations in filename order against a database initialized from
`Specifiche/dashboard_v4_schema_corrected.sql`. Legacy `sessions` rows remain
untouched until migration `009`, which converts their raw tokens to hashes
before removing the old table.

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

Migration `009_shared_test_readiness.sql` safely converts and removes legacy
`sessions`, installs the canonical `scoped_reader` role and scoped-admin
indexes, enforces one non-contradictory assignment per user/node/role/scope,
and creates the non-login `dashboard_app` privilege group. A deployment must
create a dedicated LOGIN role, grant it `dashboard_app`, and use that identity
in `DATABASE_URL`; the Web service must never connect as `postgres`.

Example (supply the password through the operator's secret-management flow,
never commit it):

```sql
CREATE ROLE dashboard_web LOGIN PASSWORD '<managed-secret>' IN ROLE dashboard_app;
```

Set `REQUIRE_RESTRICTED_DB_ROLE=true` in the Web deployment. Production also
rejects `postgres` automatically.

Migrations `010`–`012` are the canonical home for relation-field metadata,
node custom payloads, and managed-enum option tables. The former second SQL
track under `packages/core/src/infrastructure/schema` was removed so every
deployment follows this single ordered directory.
