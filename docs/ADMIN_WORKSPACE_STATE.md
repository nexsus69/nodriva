# Admin workspace state contract

Every Admin module has two classes of state:

- server data and cache state, which remain authoritative in the application cache;
- workspace state, which reconstructs the user's current administrative context after a reload.

Tabs, selected resources, open drawers/modals, drafts, filters, sorting and wizard steps are workspace state. They must not be stored only in component-local `useState`. New modules must use `useAdminModuleState(moduleKey, defaults)` so the state is namespaced, persisted in the Admin workspace store and restored consistently.

Component-local state is reserved for ephemeral rendering details that do not affect the user's place or unsaved work, such as an animation phase or a temporary hover state.
