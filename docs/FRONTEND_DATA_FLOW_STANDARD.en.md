# Component → view → cache → backend standard

[English](FRONTEND_DATA_FLOW_STANDARD.en.md) | [Italiano](FRONTEND_DATA_FLOW_STANDARD.md)

This is the standard for creating and maintaining frontend components.

## Read path

```text
React component
  → view hook/coordinator
  → semantic cache (local read model)
  → Server Action / API
  → Application Service
  → session, permission and scope checks
  → repository and database
```

The component must not import a Server Action, repository or infrastructure
adapter directly. The view decides which data is needed; the coordinator checks
cache and fetches only when data is missing, incomplete or stale. The backend is
authoritative for access and consistency.

## Mutation path

Forms and commands use the shared mutation coordinator. It preserves the
session, active lock, expected `rowVersion`, draft and semantic error while the
Application Service performs authorization, validation, transaction, audit and
outbox work. A successful response updates the canonical cache with the
authoritative resource and version; a failed response never silently resets the
draft.

The component does not decide ACL, deletion policy, encryption, conflict or
whether an event is valid. It renders the result returned by the application
contract and exposes recovery actions appropriate to the error.

## Realtime continuity and conservative fallback

Realtime events are invalidation signals, not a second source of data. The
invalidation coordinator resolves the affected resource and collection and
reloads through the same authorized read path. Events that are duplicated,
older than the cached `rowVersion` or produced by the local mutation are
coalesced.

When realtime is disabled, the coordinator marks the generation `disabled` and
loads the requested window on a meaningful access. It must not open channels,
call authentication endpoints or display a capability failure. The observable
read result, filters, authorization and concurrency remain the same.

## Session and security

Human input (`pointerdown`, `keydown`, `input` and `wheel`) keeps the session
alive through the shared activity policy. Passive polling, cache refresh and
realtime listening do not renew it. Network errors do not prove expiry; only a
`401` or an authoritative negative check enters `Session expired`, clears cache
and stops listeners.

Forms register a dirty guard only when their value differs from the persisted
baseline or has new attachments. Navigation, refresh, logout and tab close ask
for confirmation; validation, network and persistence errors retain both draft
and lock. The backend, never the UI cache, owns lock and `rowVersion` authority.

## Operating rules

- A page boundary composes a screen; it does not own state or effects.
- Hooks/controllers own state machines, transitions, retries and cache calls.
- Presentation components receive typed values and callbacks.
- Mapping errors, form coercion, session protocol and cache invalidation are
  centralized and not reimplemented per screen.
- A shared abstraction is introduced only when it removes real duplication or
  protects an invariant.
- Every behavior change has a regression test or a documented technical reason
  why a test cannot be written.

## Administrative interaction and semantic values

Administrative forms use semantic catalogues for finite choices. A localized
label and description are primary; the stable technical key is submitted to the
backend and shown only as secondary support context. Historical values have an
explicit legacy/unavailable fallback.

Configuration uses progressive disclosure: intent and trigger first, actions
next, then conditions and technical options. Filters, selected resources,
wizard step and drafts are stored in the Admin workspace state contract. A graph
is added only when branches or dependencies make a linear form ambiguous.

## Cross-cutting component reactivity contract

Every component that consumes shared data declares its semantic dependencies and
uses the common coordinator. It must not subscribe to a private channel or
invalidate an arbitrary cache key. The coordinator owns deduplication,
generation, stale transitions and authorized reload.

### Interaction continuity

The active row, selection, expanded branch, focus and scroll anchor survive a
reload whenever the authoritative result still contains them. A page change
keeps the pagination control visible and focused; a shorter final page cannot
leave focus on a removed element. Loading retains previous rows until the new
authoritative response.

#### Stable identity

List and tree rows use canonical `(domain, id)` identity. They do not use array
index or a copied label as React key. A resource move, rename or realtime update
therefore updates the existing record rather than creating a duplicate row.

#### Operation classes

The coordinator distinguishes initial load, pagination, refresh, mutation,
reconnect and background return. Each class has an explicit stale/loading/error
transition and a rule for whether the previous projection remains visible.

#### Ownership and composition

The shared controller owns protocol and timing; a screen owns only its route
intent and presentation. Resource-specific coordinators own query
normalization, authorized read port and projection policy. No generic helper
may decide ACL or infer a relation from a partial view.

#### Mandatory verification

Tests cover loading, empty, error and stale states, repeated events, out-of-order
responses, reconnect, pagination anchoring, selection, unsaved forms, lock
conflicts and the behavior with realtime disabled. Browser E2E covers the
canonical vertical on both persistence profiles.

## Mandatory design contract for components and hooks

Before implementation, record:

1. bounded context and owner of the rule;
2. input/output types and the backend contract used;
3. state machine and transitions, including cancellation and retry;
4. cache keys, semantic dependencies and invalidation source;
5. session, lock, `rowVersion` and dirty-form behavior;
6. error mapping and the user-visible recovery path;
7. unit, integration and browser tests.

If the component cannot state these items, it is not ready. Do not move
application policy into a hook merely to make a screen convenient.

## Route composition

`page.tsx` and `layout.tsx` resolve route parameters and compose a screen. They
do not contain reducers, effects, state machines, direct repository calls or
duplicated error mapping. The architecture test enforces the route size limit
and rejects React state/effect hooks in those boundaries.

### Form builders, surfaces and nested drafts

Dynamic node and entity forms use the same metadata renderer, initialization,
coercion, attachment recognition and upload helper. A form opened from a list
retains its internal return context; after save or cancellation it returns to
the opening surface rather than implicitly navigating to a parent record.

The return target is an internal path validated before navigation. A direct URL
uses an explicit local fallback and cannot become an open redirect. Nested
drawers and dialogs have their own draft and lock state but use the shared
session and mutation contracts.

## UI flow error handling

Error mapping is performed by the shared API error resolver. Components render a
localized message key and structured details, not arbitrary server text. An
unknown historical code uses the safe server fallback and remains observable in
diagnostic logs without secrets.

### Result of user-started mutations

Validation errors retain input and do not create audit records. Authorization,
lock and stale-version errors retain the draft and explain the recovery action.
Infrastructure failures are distinct from application denials and may offer a
retry; they must never be presented as a permission decision. A successful
mutation establishes a new baseline and updates cache only with the returned
authoritative version.

## Loading states

Every collection and detail surface distinguishes loading, empty, unavailable,
error and stale. A reload keeps the previous authorized projection visible until
the new response, while an initial load may show a skeleton. A capability that
is disabled has an intentional empty/disabled state, not a client exception.

## Migration

When converting an existing screen, first identify its current cache, error,
session and mutation owners. Move one responsibility at a time to the shared
contract, add a regression test, and remove the old duplicate path. Do not
introduce a second cache or parallel interpretation of `rowVersion` during the
migration. Update both language editions of the affected normative document.

## Paginated administrative catalogues

Unbounded administrative catalogues use server pagination. The backend owns
scope, filters, ordering, cursor/offset and total information; the browser
requests only the selected window. It must not fetch every page to build a local
complete dataset.

`PagedWindowCoordinator` may retain a bounded LRU of visited windows and an
index from resource to window. It deduplicates requests and drops responses from
an older generation, but it never decides authorization, normalizes a domain
query or merges a full dataset. Each catalogue coordinator owns those semantic
responsibilities and its realtime impact policy.

Small finite catalogues may use client pagination only when their owner
documents the bound. Tests cover first load, forward/back navigation, a short
last page, eviction, filter/order changes, realtime refresh and SQLite/PostgreSQL
parity.
