# Dynamic type lifecycle

`node_types` and `entity_types` have two distinct states, applied by both the
PostgreSQL and SQLite adapters.

| Field | State | Contract |
| --- | --- | --- |
| `is_active` | `false` | The type exists and remains administrable, but is not operational. It is excluded from runtime repositories and its schema is not resolved. It can be enabled again. |
| `deleted_at` | not `NULL` | The type is a tombstone: it is excluded from runtime flows and normal Admin lists/details. An explicit restore flow would be required before it could be used again. |

## Flows

- A type is created active (`is_active = true`, `deleted_at = NULL`).
- `disableType` is reversible: it sets `is_active = false`, increments the row
  version and invalidates the schema registry. It is rejected when the type has
  active instances.
- `enableType` restores `is_active = true` and invalidates the schema registry.
- The Admin service uses the administrative repository, which includes
  inactive types for inspection and re-enablement, but always excludes
  tombstones.
- Runtime repositories and `TypeDefinitionReader` always require both
  `is_active = true` and `deleted_at IS NULL`.

There is currently no application command that sets `deleted_at` on a type. The
field is reserved for a future logical-deletion flow with explicit restore and
must not be used as a synonym for disabling a type.
