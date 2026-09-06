# Attachment storage format

Local attachment storage uses explicit file envelopes so plaintext content
cannot be mistaken for an encrypted payload merely because it starts with a
magic header.

- `DASHRAW1` identifies plaintext written by the current implementation.
- `DASHATT2` identifies the authenticated, versioned AES-256-GCM envelope.
- `DASHATT1` remains readable for legacy encrypted files.
- Files without a recognized header remain readable as legacy plaintext.

New plaintext writes always include `DASHRAW1`. This is intentionally a file
format change without a database migration: storage keys and metadata remain
unchanged, while old files remain readable. The rotation operation can encrypt
legacy plaintext files when an encryption key is available.
