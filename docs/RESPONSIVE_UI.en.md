# Responsive UI

The frontend supports operational and administrative routes at 320, 375, 768
and desktop widths. Administrative tables use a card representation on narrow
viewports; forms, toolbars, pagination, dialogs and long identifiers adapt
without introducing horizontal page overflow.

## Breadcrumb

The `ResponsiveBreadcrumb` component centralizes breadcrumbs for both the
administrative panel and hierarchical node navigation.

- desktop shows every hierarchy level;
- the first level is an SVG Home icon with an accessible label and tooltip,
  without additional visible text;
- mobile shows Home, the nearest levels and the current level;
- intermediate levels become `…` when the path is long;
- the current level remains visible and is truncated only visually, while the
  complete name remains in the tooltip;
- links, separators and lock indicators are non-compressible where necessary
  and must not overlap.

Browser verification covers 320, 375, 768 and 1280 pixel widths, checking
overflow, overlap, Home reachability and presence of the current level.

Responsive layout changes must preserve hierarchy, focus order, keyboard
accessibility, unsaved drafts, modal boundaries and the semantic meaning of
actions. Tables and forms may switch to stacked or scrollable presentations,
but must not silently drop fields, filters, validation errors or selection
state. Breakpoints belong to shared presentation tokens; screens must not
invent incompatible local breakpoints or duplicate form coercion and error
mapping.

Every user-visible responsive change requires browser coverage at representative
narrow and wide viewports, including loading, empty, error, modal, pagination
and unsaved-change states.
