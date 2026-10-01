# Resource metadata forms

The frontend builds resource forms from field metadata through
`ResourceFormRenderer`. The backend defines the field type; the renderer picks
the corresponding control and provides common labels, required-state,
coercion, validation display and submit behavior.

Supported metadata includes string/text, integer/number/decimal, boolean, date,
datetime, enum, relation and attachment fields. Unknown or unavailable types
must produce an explicit, non-destructive fallback. Backend validation remains
authoritative and failed submits preserve the draft and the active session.
