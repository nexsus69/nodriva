# Static and managed enums

[English](MANAGED_ENUMS.en.md) | [Italiano](MANAGED_ENUMS.md)

## Purpose

An `enum` field represents a value selected from an option catalogue. The
technical value is stored in the instance, while the label is shown in the
interface.

Example:

```text
value: published
label: Published
```

## Modes

Each enum field can be:

- `static`: options are defined in schema configuration and the frontend can
  only select them;
- `managed`: authorized users may add options from the instance-creation form.

The mode is configured when the field is created in type administration.

## Persistence

Managed options are persisted in:

- `node_type_field_enum_options`;
- `entity_type_field_enum_options`.

Each option contains a technical value, label, position and active state. The
unique constraint is `(field_id, value)`.

Legacy `enum` constraints with comma-separated values remain supported as a
compatibility fallback:

```text
draft,published,archived
```

New options use the dedicated tables instead.

## Frontend flow

1. The frontend reads the type definition from the backend.
2. The enum field is rendered as a `select`.
3. Managed enums expose an `Add option` action.
4. The backend verifies authentication, permission, enum field and value
   uniqueness.
5. After commit, the option becomes available in the catalogue and the schema
   is invalidated.

The cache is not authoritative: final value validation runs in the backend
against the updated definition.

## Security rules

- options must have a valid, unique technical value;
- a static enum cannot be extended from the frontend;
- options are not physically deleted during ordinary use and must be disabled;
- existing instances remain readable when an option is disabled;
- every change goes through the application service and its authorization
  checks.

## Migration

The structure is introduced by:

```text
db/migrations/012_managed_enum_options.sql
```
