# Dynamic type lifecycle

[English](TYPE_LIFECYCLE.en.md) | [Italiano](TYPE_LIFECYCLE.md)

`node_types` and `entity_types` have two distinct states:

- `is_active = false`: the type exists and remains administrable, but is not
  operational, is excluded from runtime repositories and can be re-enabled;
- `deleted_at IS NOT NULL`: the type is a tombstone, excluded from runtime and
  normal administration lists, and requires an explicit future restore flow.

New types are active. `disableType` is reversible, increments `rowVersion` and
invalidates the schema registry; it is rejected while active instances exist.
`enableType` reverses it. Runtime readers require both active state and a null
`deleted_at`. There is currently no application command that sets `deleted_at`;
do not use it as a synonym for disabling.
