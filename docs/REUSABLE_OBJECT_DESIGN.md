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
- `ResourceFormRenderer`, `ResourceFormDefinition`, and `ResourceFormDraft`
  compose stable identity fields with dynamic metadata and route a flat form
  value back to the canonical draft segments. Node and entity screens must not
  recreate native selects, attachment mapping, or nested forms.
- `CustomSelect` is the sole select-control implementation. Static type
  choices, filters, and asynchronously loaded relation candidates all expose
  the same keyboard and accessibility contract.
- `ConfirmDialogStore` and its root `ConfirmDialogHost` are the only in-app
  confirmation path. A browser-native `beforeunload` warning remains the sole
  exception because browsers cannot display a custom confirmation surface while
  closing or reloading a document.
- All user-visible Admin Panel text is defined for both supported locales.

Static architecture tests enforce the single confirmation, table, surface and
translation paths. A new module must extend these contracts instead of adding
another route map or local implementation.

## Admin experience design system

The Admin experience is a presentation concern inside the Administration and
Frontend Read Model bounded contexts. It may depend on React, the Admin module
and resource definitions, localized messages, application actions, and the
normalized frontend cache. It must not depend on SQL, persistence adapters, or
database-specific behavior.

Shared Admin visual behavior is owned by reusable components and tokens:

- `AdminIcon` owns the application icon vocabulary and accessible SVG output;
- `AdminPageHeader` owns title hierarchy, breadcrumbs, description, and primary
  actions;
- `AdminToolbar` owns search, filters, result metadata, and refresh actions;
- `AdminTable` owns row navigation, stable rows, action menus, loading
  geometry, empty states, and density;
- `AdminSurfaceHost` owns modal, drawer, and replacement-surface geometry,
  focus, backdrop, and sticky action areas;
- `FormDefinition` and `FormRenderer` own form grouping and responsive column
  layout;
- feedback, badges, buttons, and skeletons use semantic Admin design tokens.

Modules configure these objects. They must not recreate page headers, table
toolbars, action placement, loading placeholders, or surface chrome locally.

## Operational resource administration

Node and entity administration belongs to the Hierarchy and Entity bounded
contexts, exposed through the Administration presentation layer. The modules
may read through existing authorized application actions and the normalized
cache. Mutations continue to use `NodeApplicationService` and
`EntityApplicationService`; therefore authorization, validation, locks,
`rowVersion`, audit, transactions, and realtime remain backend-owned.

These modules run outside database transactions. Their server actions invoke
existing application services whose mutations define the transaction and
post-commit boundaries. They require no new persistence port and must never
load unrestricted records directly from an adapter. Lists are projections of
the actor's readable roots and subtrees, so a local administrator sees only the
same operational perimeter available in the workspace.
