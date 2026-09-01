# Security operations

This runbook is the operational contract for audit evidence and administrative
identity recovery. It deliberately separates actions that must be implemented
by the application from actions owned by the deployment operator.

## Audit retention, export, and review

`audit_logs` is append-only application evidence. Application roles receive
`audit.access` only when they must read it; no UI or query port may expose it
to an unauthorised actor. Database write credentials used by the web service
must not have `DELETE` or `TRUNCATE` on this table.

Keep online audit data for 365 days. On the first business day of every month,
an operator exports the preceding month as newline-delimited JSON, stores it in
the approved immutable archive with encryption and a retention lock of seven
years, verifies the object checksum, and records the archive reference in the
change-management system. Only after a verified archive exists may records
older than 365 days be purged, in bounded batches, by a separately authorised
maintenance job. Backups are not a substitute for this export.

Every quarter, a super-admin who did not grant the reviewed access performs an
access review: export active users, global roles, scope assignments (including
allow/deny and propagation), and super-admins; compare the result with the
approved owner list; revoke exceptions; and retain the signed review record.
The review must also inspect password resets, user activation/deactivation,
role and scope mutations, and failed login-rate-limit events.

## Administrative credentials

The existing administrator password reset is an emergency recovery tool: it
requires a super-admin, invalidates all target sessions, and writes an audit
record. It must not be used as a self-service password-reset substitute or to
communicate a password in clear text.

Before enabling invitations or public password reset, deploy all of the
following together: a one-time, hashed, expiring token store; a mail-delivery
adapter; a public completion page that consumes the token atomically; a shared
rate limiter keyed by account and source address; and optional MFA enrolment
using an encrypted TOTP secret plus recovery codes. MFA is optional only in
the product sense: when enabled for an administrative identity it must be
required at every new login and recovery/reset must revoke the factor.

An in-process rate limiter is explicitly insufficient because web replicas
would not share state. Use a database or Redis-backed adapter and emit a
structured audit/security event for a block, without exposing whether the
email address exists.

The Web composition uses the shared PostgreSQL limiter for both a normalized
account key and the trusted proxy source address. Configure the proxy to replace
(`not append to`) its client-IP header. Account-action delivery is fail-closed:
set `ACCOUNT_ACTION_DELIVERY_WEBHOOK_URL`, `ACCOUNT_ACTION_PUBLIC_BASE_URL` and
the optional bearer secret. `ACCOUNT_ACTION_DELIVERY_TIMEOUT_MS` imposta il
timeout della richiesta (10 secondi se omesso). The HTTPS endpoint receives
`to`, `template`, `actionUrl` and `expiresAt` and must send the corresponding
email.

TOTP requires `MFA_ENCRYPTION_KEY`, a base64-encoded 32-byte deployment secret.
Enrollment secrets are AES-256-GCM encrypted; recovery codes are stored only as
SHA-256 hashes. Rotate this key only with a planned re-enrollment or a dedicated
data re-encryption procedure.

## Portability review

PostgreSQL-specific features are confined to `infrastructure/postgres` and its
migrations: `ltree` hierarchy operators and GiST indexes; `FOR UPDATE SKIP
LOCKED` outbox claims; transactional trigger maintenance; JSONB; and dynamic
identifier quoting for per-type tables. The domain/application layers expose
only ports and must never import a PostgreSQL adapter or SQL.

A replacement adapter must provide equivalent hierarchy containment,
transaction and locking semantics, safe identifier handling (identifiers are
never SQL parameters), optimistic concurrency, and an atomic outbox claim. Its
integration suite must cover allow/deny subtree ACL parity, concurrent claims,
rollback, and invalid dynamic identifiers before it can be wired in the
composition root.

## Encryption key management

`FIELD_ENCRYPTION_KEY` and `ATTACHMENTS_ENCRYPTION_KEY` remain deployment
secrets and must be supplied by a secret manager or KMS integration; they must
never be committed in `.env` files or logs. The services accept a keyring in
the form `v1=<64 hex chars>,v2=<64 hex chars>` through respectively
`FIELD_ENCRYPTION_KEYS` and `ATTACHMENTS_ENCRYPTION_KEYS`. The active version
is selected by `FIELD_ENCRYPTION_ACTIVE_VERSION` or
`ATTACHMENTS_ENCRYPTION_ACTIVE_VERSION`.

New values are encrypted with the active key. Existing values retain their
stored key version and remain decryptable while the old key is present. Field
ciphertexts include the version in the database metadata and attachment files
written by the new format include it in the authenticated storage envelope;
legacy `v1` values remain readable for compatibility.

Rotation procedure:

1. create a new random 32-byte key in the secret manager;
2. deploy the old and new keys together, with the new version active;
3. execute and monitor the authorised `pnpm encryption:rotate` batch job;
4. take and verify a backup before removing the old key;
5. remove the old key only after all ciphertexts and attachments have been
   re-encrypted and a restore test with the new key succeeds.

The application provides dual-key decryption, active-key encryption and the
separate resumable bulk re-encryption job. Its durable status and audit events
must be reviewed before retiring an old key; backup verification remains
mandatory.
