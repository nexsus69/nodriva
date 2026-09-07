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
