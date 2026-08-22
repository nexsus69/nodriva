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

The Admin Panel applies this rule through `AdminModuleDefinition`,
`AdminSurfaceDefinition`, shared form/table objects, and module-specific
adapters. `AdminSurfaceHost` owns the common modal, drawer, and inline surface
layout so modules provide configuration and content rather than layout logic.
