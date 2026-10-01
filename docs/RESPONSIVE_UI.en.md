# Responsive UI

[English](RESPONSIVE_UI.en.md) | [Italiano](RESPONSIVE_UI.md)

The Web interface must remain usable from narrow mobile viewports through large
desktop screens. Layout changes must preserve hierarchy, focus order, keyboard
accessibility, unsaved drafts, modal boundaries and the semantic meaning of
actions.

Tables and forms may switch to stacked or scrollable presentations, but must not
silently drop fields, filters, validation errors or selection state. Responsive
breakpoints belong to shared presentation tokens; screens must not invent
incompatible local breakpoints or duplicate form coercion and error mapping.

Every user-visible responsive change requires browser coverage at representative
narrow and wide viewports, including loading, empty, error, modal, pagination and
unsaved-change states.
