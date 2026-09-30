# Attachment storage format

Local attachment storage uses explicit file envelopes so plaintext content
cannot be mistaken for an encrypted payload merely because it starts with a
magic header.

- `DASHRAW1` identifies plaintext written by the current implementation.
- `DASHATT2` identifies the authenticated, versioned AES-256-GCM envelope.
- Files without a recognized header are rejected as invalid.

New plaintext writes always include `DASHRAW1`. During the current development
phase there is no legacy compatibility contract: unversioned files and the
obsolete `DASHATT1` format are rejected. The rotation operation converts the
explicit plaintext envelope to `DASHATT2` when an encryption key is available.

## Mutation contract and concurrency

`AttachmentApplicationService` owns attachment authorization and lifecycle.
Upload commands include the authenticated user/session and `expectedRowVersion`;
HTTP multipart requests carry that version as a form field. DELETE requests
carry the expected numeric version in `If-Match`. Missing session/version is
rejected. `X-Mutation-Id` correlates the browser operation with its durable
event; entity events also retain the entity type namespace for cache refresh.
Both mutations use the existing node/entity edit service, including
its ACL, owned-lock requirement when locking is enabled, and conditional version
write. Successful responses include the authoritative resource and new version.
Clients chain versions for multiple files and retain completed uploads when
retrying a partially successful batch. New-resource forms acquire a lock for
their attachment phase and release it afterwards.

Blob staging and optional scanning precede the final database transaction.
That transaction rechecks access, the active attachment field and security
policy; a changed encryption/scanning policy rejects the staged upload. It
persists the aggregate version/revision, attachment metadata, audit, cleanup
state and (when enabled) realtime outbox before any delivery. An enqueue
failure rolls back the aggregate and metadata. SQLite deliberately omits
realtime when disabled, with the same mutation outcome.

PostgreSQL serializes quota/rate accounting with separate advisory-lock and
read statements, so waiting requests see the preceding commit. Shared locks
on policy/catalog tables stabilize the final checks, including absent overrides;
this can briefly delay administrative policy changes. SQLite uses its shared
connection gate and `BEGIN IMMEDIATE` instead, without PostgreSQL mechanisms.

## Durable orphan cleanup

Blob storage is not transactional, so metadata changes use
`attachment_cleanup_outbox` as the durable bridge. Upload registers a delayed
staging cleanup before writing the blob and cancels it in the transaction that
creates metadata and audit. Delete and purge enqueue immediate cleanup in the
transaction that removes metadata and records audit. A best-effort drain runs
after commit; the protected worker endpoint retries pending rows with leases and
backoff in both PostgreSQL and SQLite. Deleting an already absent blob is a
successful idempotent cleanup.
