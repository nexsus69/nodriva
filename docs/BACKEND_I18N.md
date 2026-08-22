# Backend internationalization contract

The backend supports English (`en`) and Italian (`it`). Domain and application
services must remain language-neutral: they expose stable error codes and
structured details, never UI text selected for a user.

At an API boundary, a message may contain:

- `messageKey`: a stable catalog key;
- `messageParams`: primitive interpolation values;
- `message`: a safe fallback for clients that do not yet use the catalog.

The locale is negotiated from an explicit user preference first, then the
request `Accept-Language` header, with English as the deterministic fallback.
Locale tags are normalized through the shared Core contract in
`application/i18n/Locale.ts`.

New errors must add a stable code/key and parameters before adding translated
text. Existing Italian error strings remain compatibility fallbacks while the
boundary mapper is migrated to the catalog incrementally.
