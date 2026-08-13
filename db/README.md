# Database migrations

La procedura verificata di backup e restore è documentata in
`docs/BACKUP_RESTORE.md` e nello script `scripts/postgres-backup-verify.sh`.
Il comando di verifica ripristina sempre in un database temporaneo e non
sostituisce il database operativo.

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

Migration `020_controlled_schema_ddl.sql` removes generic `CREATE` access from
the application role and installs the controlled DDL gateway used for dynamic
entity storage tables. The `dashboard_schema_manager` role is `NOLOGIN` and
owns only the `SECURITY DEFINER` functions and dynamic entity tables. The web
role receives `EXECUTE` on those functions, never direct `ALTER TABLE`,
`CREATE TABLE`, `DROP`, or arbitrary schema DDL privileges. Each function
checks the requested table and column against the entity metadata before
executing a narrowly scoped operation.

Migration `022_field_ciphertext_lifecycle.sql` keeps encrypted field sidecars
aligned with their metadata and resources through database triggers. Removing
a field or resource removes its ciphertexts in the same transaction,
preventing orphaned encrypted values.

Migration `023_dynamic_table_crud_privileges.sql` grants the application role
CRUD access to registered dynamic entity tables while keeping schema creation
and alteration restricted to the controlled DDL gateway.

Migration `024_deleted_entity_management_permissions.sql` adds separate
`entity.restore` and `entity.purge` permissions. The recycle bin exposes both
restore and permanent purge through separately authorized application flows.

Migration `025_subtree_deletion_batches.sql` adds deletion-batch provenance to
nodes and entities. Subtree restoration can therefore restore only records
deleted by that cascade, without resurrecting records that had been deleted
individually beforehand.

Migration `026_realtime_metadata_sequence.sql` adds the monotonically
increasing metadata sequence used to reconcile client caches after type and
configuration changes. Migration `027_realtime_capability.sql` adds the
runtime capability controlling server-side realtime publication.

Migration `029_encryption_rotation_jobs.sql` adds the durable status table used
by `pnpm encryption:rotate`. The batch job and its verification procedure are
documented in `docs/ENCRYPTION_ROTATION.md`.

Migration `030_service_configurations.sql` adds the versioned provider/runtime
configuration store. Deployment endpoints and secrets remain outside it.

Migration `031_node_root_path_label_uniqueness.sql` aligns PostgreSQL root-node
uniqueness with SQLite by treating a `NULL` parent as an equal scope for active
path labels. Soft-deleted paths remain reusable.

Migration `032_attachment_upload_rate_limit.sql` adds the durable PostgreSQL
upload-event window consumed through `AttachmentRateLimitPort`; SQLite provides
the same observable contract in its local schema.

Migration `033_session_idle_timeout_30_minutes.sql` updates existing active
session timeout settings to the current 1800-second default. Fresh PostgreSQL
and SQLite seeds use the same value.

Migrations `010`–`012` are the canonical home for relation-field metadata,
node custom payloads, and managed-enum option tables. The former second SQL
track under `packages/core/src/infrastructure/schema` was removed so every
deployment follows this single ordered directory.
