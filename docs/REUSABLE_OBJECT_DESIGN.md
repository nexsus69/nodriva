# Reusable object design rule

Every new feature must be designed as a reusable object, definition, contract,
or controller before it is implemented for a single screen or use case.

## Required approach

1. Identify the behavior that is common across current and future use cases.
2. Define an object or contract that owns that behavior and its invariants.
3. Keep domain-specific code in a configuration object or a narrow adapter.
4. Make persistence, transitions, validation, errors, and lifecycle behavior
   part of the reusable object when they are shared concerns.
5. Add a focused test for the reusable object before relying on it in a module.

## Prohibited approach

- Do not implement a reusable behavior directly inside one page or screen.
- Do not duplicate modal, form, table, cache, navigation, or draft logic across
  modules.
- Do not add a parameter that only hides a case-specific branch while the real
  behavior remains embedded in the consumer.
- Do not call a feature reusable if its lifecycle or persistence behavior is
  still controlled by local component state.

## Review questions

Before considering a feature complete, verify:

- Can another module instantiate it through a definition or adapter?
- Does the object own its state transitions and cleanup?
- Are reload, error, pending, confirmation, and draft rules consistent?
- Is the consumer mostly configuration rather than copied implementation?
- Is the reusable contract documented in English and covered by tests?

The Admin Panel applies this rule through `AdminModule`,
`AdminResourceDefinition`, `AdminSurfaceDefinition`, shared form/table objects,
and module-specific adapters. `AdminSurfaceHost` owns the common modal, drawer,
and inline surface layout so modules provide configuration and content rather
than layout logic.

Node selection follows the same rule. A form declares a `nodeTree` field with
its authorized node catalogue, localized labels, interaction mode and form
value. `FormRenderer` owns hierarchical rendering, direct selection,
drag-and-drop, validation presentation and draft integration. Administrative
modules must not mount a separate node picker or manually synchronize a hidden
node identifier alongside a form definition.

## Admin Panel invariants

The Admin Panel has one implementation path for each shared behavior:

- `AdminModuleRegistry` is the canonical navigation and route catalogue;
  visible navigation is projected from backend-verified permissions.
- `AdminWorkspaceStore` persists module navigation, filters, pagination,
  selected resources, surface mode, surface resource identity and drafts.
- `AdminResourceDefinition` declares operation permissions and
  `AdminResourceController` owns loading, pending, error and mutation refresh
  transitions. Backend authorization remains authoritative.
- `AdminCollectionScreen`, `AdminTable` and `AdminPagination` render every
  ordinary administrative collection. A specialized table is allowed only
  when it owns a distinct interaction such as field reordering.
- `AdminSurfaceHost` is the only modal/drawer host and the application
  confirmation service is the only confirmation path.
- Forms use `FormDefinition` and `FormRenderer`; a field type, required rule or
  validation rule must not acquire a module-specific interpretation.
- All user-visible Admin Panel text is defined for both supported locales.

Static architecture tests enforce the single confirmation, table, surface and
translation paths. A new module must extend these contracts instead of adding
another route map or local implementation.
