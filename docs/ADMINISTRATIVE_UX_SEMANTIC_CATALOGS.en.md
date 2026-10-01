# Administrative UX semantic catalogs

Finite catalogs are presented with searchable localized names and contextual
descriptions. The technical value sent to the backend remains stable and is not
replaced by user-entered text. Historical or unavailable values have an explicit
fallback and do not alter authorization or validation.

Complex configuration uses progressive disclosure: intent and trigger first,
then conditions and technical options. Tests cover label-to-value mapping,
loading/empty/error states, authorization and draft preservation.
