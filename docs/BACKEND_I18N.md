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

## Web presentation

The Web client resolves `ApiErrorResponse.messageKey` (or the stable error
`code` fallback) through the single `localizeApiError` resolver in
`packages/web/src/app/errors/localizeApiError.ts`. Forms and administrative
screens must not render `error.message` directly when a localized resolver is
available; unknown historical codes may use the safe server fallback.

Contextual mappings retain their own `messageKey`: account completion must
describe an invalid link, not an expired login session, even when the stable
authorization code is shared. The boundary mapper must not overwrite a
contextual key with the generic code fallback.

All new browser-facing text, including labels, placeholders, empty and loading
states, confirmation copy, tooltips and accessible names, belongs in
`packages/web/src/app/i18n/AppLocaleStore.ts` for every supported locale. The
repository command `pnpm i18n:guard`, included in `pnpm check`, rejects newly
added hardcoded browser-facing text outside that catalogue. Technical keys,
URLs, SQL, user-authored content and test fixtures are intentionally outside
this presentation rule.

Validation rejections are not audit events: only mutations that are actually
persisted are recorded in the audit stream. Authorization or abuse telemetry,
if introduced later, must use a separate security-event contract.
