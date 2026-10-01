# Static and managed enums

[English](MANAGED_ENUMS.en.md) | [Italiano](MANAGED_ENUMS.md)

An `enum` field stores a technical value from an option catalogue while the UI
renders its label. Each field is either:

- `static`: options are defined by the schema and can only be selected;
- `managed`: authorized users may add options from the creation form.

Managed options are stored in `node_type_field_enum_options` and
`entity_type_field_enum_options`; `(field_id, value)` is unique. Historical
comma-separated values remain a compatibility fallback, while new options use
the dedicated tables.

The frontend reads the type definition and renders a select. For managed enums
it exposes “Add option”. The backend rechecks authentication, permission, field
type and uniqueness before committing; schema invalidation occurs after commit.
The cache is never authoritative.

Technical values must be valid and unique. Static enums cannot be extended from
the frontend. Options are deactivated rather than physically deleted so old
instances remain readable. Every change goes through the application service.

The structure was introduced by `db/migrations/012_managed_enum_options.sql`.
