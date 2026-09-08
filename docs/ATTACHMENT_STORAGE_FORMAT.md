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

## Durable orphan cleanup

Blob storage is not transactional, so metadata changes use
`attachment_cleanup_outbox` as the durable bridge. Upload registers a delayed
staging cleanup before writing the blob and cancels it in the transaction that
creates metadata and audit. Delete and purge enqueue immediate cleanup in the
transaction that removes metadata and records audit. A best-effort drain runs
after commit; the protected worker endpoint retries pending rows with leases and
backoff in both PostgreSQL and SQLite. Deleting an already absent blob is a
successful idempotent cleanup.
