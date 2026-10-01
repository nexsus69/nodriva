# Attachment storage format

Attachment metadata is stored with the owning resource and includes a stable
identifier, filename, media type, size, checksum and storage reference. Binary
content is kept behind the configured storage port; credentials and private
paths never cross the API boundary.

Upload, download, replacement and deletion verify scope, authorization and
audit requirements. Unsupported formats fail explicitly without losing the
existing attachment.
