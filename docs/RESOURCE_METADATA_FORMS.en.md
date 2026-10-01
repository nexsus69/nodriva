# Resource forms and metadata

The frontend builds resource forms from field metadata through
`ResourceFormRenderer`. The backend defines the field type; the renderer picks
the appropriate HTML control and provides common behavior for labels,
requiredness, values and submit.

## Supported types

| Metadata type | Frontend control | Notes |
|---|---|---|
| `string` | text input | Short text |
| `text` | text input | Short free text |
| `integer` | numeric input | Integer step |
| `number` | numeric input | Numeric value |
| `decimal` | numeric input | Decimal value |
| `boolean` | checkbox | True/false value |
| `date` | `date` input | Date without time |
| `datetime` | `datetime-local` input | Local date and time |
| `uuid` | text input | Backend validates UUID format |
| `json` | textarea | Multiline JSON payload |
| `array` | textarea | Serialized array representation |
| `enum` | select | Options supplied by metadata |
| `relation` | search + select | Target declared by metadata; resolver and scope filter results |
| `file` | attachment selector | Documents linked to the field; separate storage |
| `image` | image selector | Images linked to the field; separate storage |

Files and images are metadata field types, not dynamic column types. The backend
registers them in the type and stores content in `resource_attachments`.
`AttachmentInput` is shown only when the resource type declares that field; the
content is not saved in `payload` or a PostgreSQL column. The API rejects an
upload or listing when the field does not exist or the requested type
(`file`/`image`) does not match metadata.

`timestamp` is accepted as a compatibility alias for `datetime` in data that
already exists in the system.

## Resource relationships

A `relation` field explicitly declares its domain (`node` or `entity`) and the
target type's `typeKey`. It also declares whether a source may have one or many
targets and, optionally, whether a target may be used only once. The frontend
uses the common resolver to search resources in every readable node and shows
the node path; it does not limit selection to siblings of the current resource.
The backend verifies again that the target exists, belongs to the declared type
and is readable by the user, both on create and update. An unauthorized
reference is rejected even when sent directly to the API.

Relationships are stored as canonical edges; existing dynamic columns remain a
compatibility projection during migration. Detail values are resolved with the
same ACL check and can link to a target entity in another node. The complete
contract, including inverse relationships and bulk operations, is in
[`RESOURCE_RELATIONSHIP_ARCHITECTURE.md`](RESOURCE_RELATIONSHIP_ARCHITECTURE.md).

## Attachments

`ResourceAttachmentReference` stores attachment metadata: resource, field,
name, MIME type, size, storage key, checksum and author. The file is uploaded to
dedicated storage and the database retains only metadata. The local provider
stores content outside the database and applies a SHA-256 checksum. Production
must set `ATTACHMENTS_ENCRYPTION_KEY` to a random AES-256 hexadecimal key;
`ATTACHMENTS_REQUIRE_ENCRYPTION=true` makes startup fail when the key is
missing. Never commit the key.

Upload validates extension, declared MIME and magic bytes, rejects SVG/HTML and
other executable content, applies per-file, per-resource and per-user limits,
and never includes content in audit. For mandatory antivirus scanning enable
`attachments.antivirusEnabled` and configure an `AttachmentScannerPort`; an
upload is rejected when no scanner is configured. The deployment override
`ATTACHMENTS_REQUIRE_SCAN=true` remains available for fail-closed behavior.

The reference/test Compose profile supplies ClamAV through the optional
`docker-compose.antivirus.yml` overlay. Web does not depend on that container
when the overlay and capability are disabled. A distributed deployment may
configure a remote ClamAV through host, port and timeout; other antivirus
adapters are not currently implemented.

Upload rate limiting uses `AttachmentRateLimitPort`: PostgreSQL stores events in
`attachment_upload_events`, while SQLite uses its local store. Web replicas
sharing PostgreSQL therefore share the window; separate SQLite instances remain
intentionally isolated.

Encryption of new attachments is controlled by the global
`attachments.encryptionEnabled` setting. Upload remains available when the
setting is `false`, and new attachments are stored in plaintext even if a node
type has an `enabled` policy. When it is `true`, the default remains plaintext;
the node type's `enabled` policy enables encryption and `disabled` forces
plaintext. The node policy also applies to entities contained in that node.
Policy changes affect new uploads; existing attachments remain readable because
the storage format records independently whether content is encrypted.

## Selective field encryption

Each node/entity type field can use `plaintext` or `encrypted`. `plaintext` is
the default. `encrypted` stores the value in the
`resource_field_ciphertexts` sidecar only when
`data.fieldsEncryptionEnabled` is `true`, while the repository sees only the
decrypted value. The server key is `FIELD_ENCRYPTION_KEY` (with the compatible
`ATTACHMENTS_ENCRYPTION_KEY` fallback) and is never sent to the client.
`FIELD_ENCRYPTION_KEYS` and `FIELD_ENCRYPTION_ACTIVE_VERSION` support rotation:
new ciphertext uses the active version and previous versions remain readable
during transition. Encrypted fields cannot be searched, filtered or indexed;
the frontend treats them as ordinary controls only after authorized reading.

Downloads are authorized again on every request; only validated raster images
may render inline. Other files download as `application/octet-stream` with
`nosniff`, CSP, CORP and private caching.

## Responsibility separation

`ResourceFormRenderer` owns only schema-to-control mapping. `FormRenderer`
renders common controls and handles submit. The page coordinator supplies
initial values, enum/relation options and the mutation; authorization and
validation remain backend responsibilities. `dynamicResourceForm` also
centralizes payload initialization/coercion, attachment-field recognition,
validation and post-create upload to prevent divergence between node and entity
forms.

Adding a new type requires updating in one change:

1. the backend contract;
2. the mapping in `ResourceFormRenderer`;
3. the control or variant in `FormRenderer`;
4. mapping and rendering tests;
5. this documentation table.
