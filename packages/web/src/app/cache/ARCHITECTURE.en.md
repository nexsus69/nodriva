# Semantic Cache Engine — normative architecture

[English](ARCHITECTURE.en.md) | [Italiano](ARCHITECTURE.md)

This document is the canonical source for frontend cache and fetch architecture.
Every implementation, refactor or extension must respect these constraints.
Cross-cutting reactivity rules are defined in
[`docs/FRONTEND_DATA_FLOW_STANDARD.en.md`](../../../../../docs/FRONTEND_DATA_FLOW_STANDARD.en.md);
this document governs cache, while that standard governs the complete path to
rendering and takes precedence for UI-update contracts.

## 1. Fundamental principles

1. **Single source of truth (`CacheKernel`).** Each record exists once in
   `CacheKernel`, identified by `namespace + id`; entities use
   `entity:<entityTypeId>`. No component, hook, context or parallel cache may
   hold an independent copy.
2. **View/data separation.** `ViewStore` contains only navigation metadata:
   ordered `ViewPage` arrays, opaque `ViewItemDescriptor`s, bidirectional
   cursors (`prevCursor`, `nextCursor`) and `hasMoreForward`/
   `hasMoreBackward`. `CacheKernel` contains canonical payloads. Entity payload
   never crosses or resides in `ViewStore`.
3. **Automatic reactivity.** Updates, deletes and injections of canonical data
   propagate through kernel facade subscriptions. Point views update from the
   canonical record; views whose ordering, filter or membership may change are
   invalidated through dependency tokens.
4. **Fetch-agnostic UI.** React components do not know endpoints, Server
   Actions, URLs or protocols. They declare a semantic intent (`SemanticViewKey`)
   and consume results through adapter hooks. Service Layer exclusively
   orchestrates loading.

### 1.1 CacheKernel and ViewStore

`CacheKernel` is the normalized canonical store for nodes, entities and
metadata. `GlobalViewStore` keeps pages, cursors, state and record references,
never payloads. Remaining domain clients are compatibility facades, not a second
authority.

Rules:

- store each record once using `namespace + id`;
- retain completeness (`summary` or `full`) and stale state;
- a query stores only ordered IDs, namespaces and dependencies, never payload
  copies;
- mutations go through `mutate()`, which applies canonical result and declared
  invalidations only after backend success;
- invalidate dependencies through tokens so all affected queries become stale;
- discard an in-flight response and repeat loading when its query/token is
  invalidated during the request;
- ignore obsolete record versions;
- `purge()` removes records, queries and pending requests on session change or
  logout;
- a response started before session purge cannot insert data into the new cache
  epoch.

## 2. `SemanticViewKey`

### Definition

`SemanticViewKey` is a deterministic string identifying an entire logical view,
not one page or chunk.

### Derivation rules

The key is derived only from stable semantic request parameters:

- `viewType` (`SUBTREE_LIST`, `ENTITY_DETAIL`, `BREADCRUMB`);
- `baseNodeId`, when applicable;
- requested `entityId`, for `ENTITY_DETAIL`;
- `search`, when present;
- `entityTypeId`, when present;
- structured `filters`, serialized deterministically with sorted keys;
- `sort` field and direction, when present.

### Excluded elements

The key must never include pagination cursors, navigation direction, offset,
page number, limit, physical endpoint/query string, timestamp, session token or
other ephemeral value.

### Key and pages

One key identifies the whole view. `ViewPage[]` is an ordered array below the
view; logical position and current chunk are not view identity. Two components
declaring the same key share view and pages.

## 3. Service Layer

### `ViewResolver`

The single entry point for data requests. It receives a typed `ViewIntent`
(`resolve` or `extend`) and decides whether cache satisfies the view or a fetch
is required. It does not expose endpoints to callers.

### `FetchCoordinator`

The only layer allowed to know backend endpoints and Server Actions. No UI
component, adapter hook or selector may invoke a Server Action, fetch or network
API directly. `FetchCoordinator` receives typed intent from `ViewResolver` and
translates it to the appropriate backend call.

### `IngestionLayer`

It receives raw DTOs and normalizes them:

1. Split records and inject them into canonical store through typed `AppCache`
   facades.
2. Build `ViewItemDescriptor`s with typed references (`namespace`, `id`,
   `completeness`) and dependencies, never payloads.
3. Assemble `ViewPage` with cursors and `hasMore` flags.
4. Insert the page into `ViewStore`, applying cross-chunk deduplication and
   window trimming.

## 4. Satisfiability

A view is `satisfied` only when:

1. it exists in `GlobalViewStore` with at least one page;
2. each row descriptor has all `primary` and `requires` records in canonical
   namespace at the required `summary`/`full` level;
3. the view `updatedAt` is within `STALE_TTL` (default five minutes).

Otherwise state is one of:

- `missing-view`: absent from `ViewStore`;
- `missing-records`: a typed reference is absent from canonical store;
- `partial`: records exist but one is incomplete or stale for the requirement;
- `stale`: complete view expired by TTL.

`ViewResolver` reloads missing or stale views. When the view is valid but records
are missing/incomplete, `RecordHydrator` fetches only required references and
shares one Promise among concurrent requests. If point hydration is unsupported,
reload the authoritative view.

## 5. Storage and cache

### `GlobalCacheClient` (`AppCache`)

This is the `CacheKernel` container and facade. It exposes typed access for
nodes, entities partitioned by `entityTypeId` and metadata. Clients maintain
reactive subscriptions and share Promises to deduplicate concurrent hydration
of the same reference.

`AppCache` is also the only entry point for Create, Update and Delete. UI
components never invoke write Server Actions directly.

### `GlobalViewStore`

It stores navigation state indexed by `SemanticViewKey`. Each view contains an
ordered `ViewPage[]`, canonical references and dependency tokens. Reverse
reference→view and token→view indexes support invalidation without relying on
view-type names or prefixes. Application payloads are never stored here.

## 6. Lifecycle: policy, trimming and GC

### Window trimming (within a session)

During continuous scroll, `IngestionLayer` trims by direction:

- forward: push the new chunk and shift the oldest head when
  `pages.length > maxWindowChunks`;
- backward: unshift the new chunk and pop the oldest tail.

After eviction, force the trimmed edge's `hasMore` to `true` because the server
can return the removed chunk again. Keep the edge cursor in the surviving outer
page.

### Garbage collection (between sessions)

`CacheGarbageCollector` periodically sweeps `GlobalViewStore`:

- no active lease → immediate eviction;
- any `persistent` or `sticky` lease → never evict;
- all leases `windowed` and expired beyond TTL → evict.

GC acts only on `ViewStore`; descriptors are removed and cursors are lost.

### EntityStore/ViewStore lifecycle separation

Evicting a view does not delete referenced entities from `EntityStore`. Canonical
entities survive view lifecycle and are removed only through a typed
`CacheKernel` facade after confirmed backend delete. Reference-count GC is not
implemented; entities remain in memory while the session is active. This is
necessary because one entity may be referenced by several semantic views.

### Retain/release

Mounted view components call
`GlobalPolicyRegistry.retain('view', viewKey, ownerId, retentionClass)` and
`release()` during cleanup. `ownerId` is unique per hook instance. At least one
active owner lease protects the view from eviction.

## 7. Mutations: Create / Update / Delete

Mutations are orchestrated exclusively by `AppCache`; no UI component invokes a
write Server Action directly.

### Create

```ts
await AppCache.createEntity({ parentNodeId, entityTypeKey, name, description, payload });
```

1. Backend creates the record and returns saved payload, final ID and
   `rowVersion`.
2. `AppCache` injects it into canonical `EntityStore`.
3. Relevant list view is invalidated (`GlobalViewStore.delete(listKey)`), not
   patched.
4. On next mount/resolve, `ViewResolver` sees `missing-view` and reloads from
   server with authoritative ordering.

Client insertion is not safe because final position depends on server ordering.

### Update

```ts
await AppCache.updateEntity({ entityId, name, payloadDelta, expectedRowVersion });
```

Backend returns saved payload; `AppCache.inject()` updates canonical
`EntityStore`; details and forms receive it through push. Collection views are
invalidated by membership token only for create, delete, move or restore.
Ordinary `updated` events, including name, description and dynamic payload,
update the normalized record without rebuilding list windows. Unaffected point
views are not invalidated.

### Delete

```ts
await AppCache.deleteEntity(entityId, entity.entityTypeId, entity.rowVersion);
```

Backend deletes; typed `CacheKernel` facade removes the entry and notifies every
subscriber with `null`.

After confirmed delete, `GlobalViewStore` reverse index immediately invalidates
all views referencing the record. Membership tokens also invalidate collections
whose composition may change even when the record was outside the loaded
window. Detail pages send their observed `rowVersion`; the canonical menu may
call `AppCache.deleteEntity(entityId)` and let the server derive version and a
transient lock. Orphan descriptors must never be silently treated as valid list.

## 8. Official hooks (UI layer)

React components communicate with the engine only through these adapters.

### `useVirtualSubtreeData` — lists and pagination

For lists, grids and virtual trees. Input is `baseNodeId`, optional `search` and
`entityTypeId` filters and a scroll-anchor ref. Output is flat `items`,
`loadMoreForward`, `loadMoreBackward` and state flags (`isLoading`, both
`hasMore` flags and `isError`). It updates when canonical `EntityStore` data
changes.

### `useSemanticEntityDetail` — detail and form

For one-record surfaces. Input is `entityId` and optional context; output is
`entity`, `isLoading` and `error`. It reads canonical `EntityStore`, so update or
delete of the same ID is reflected immediately.

### Prohibitions

- do not use `useReadModel`, `ReadModelContext` or legacy context in new code;
- do not invoke Server Actions directly from UI for reads or writes;
- do not create local fetch caches (`useState` plus `useEffect`) for data owned by
  `EntityStore`.

## 9. Identity and access control

### Zero-trust UI

React client is untrusted. UI does not own user identity. `SemanticViewKey` and
payload never contain `actorUserId`.

### Backend-only resolution

Backend resolves identity through `FetchCoordinator`/`AuthResolver` using secure
session mechanisms (cookie/token) and converts it into an internal context.

### Native data masking (SQL filtering)

Extraction is strictly identity-bound. Visible-record filtering occurs only in
database Query Ports before Application pagination or cursor logic. In-memory
visibility filters in Application are forbidden.

### Single ACL source of truth

Authorization semantics (`allow`/`deny`, hierarchical `ltree` propagation) live
in one infrastructure point. Read Query Ports and write guards consume the same
SQL primitives.

## 10. Session lifecycle and cache eviction

### Session table and identity

Identity and access validity are stateful through database `user_sessions`. The
client keeps only an opaque token in an HTTP-only cookie; server stores and
compares only its hash. NextAuth JWT is a transport wrapper, not authorization
authority: every request is checked against `user_sessions`.

### Cache eviction

Never keep data in `EntityStore` or `ViewStore` belonging to a previous session
or user. Formal full reset is `AppCache.purgeAll()`.

- **Primary trigger:** invoke it after successful programmatic frontend logout.
- **Defensive belt:** login root route (`/login`) must call `purgeAll()` on first
  mount to clean residues from silent timeout or forced middleware redirect.
- A purge sweeps entity map and ViewKeys completely, destroying local RAM data.

A response started before session purge cannot reinsert data into the new cache
epoch. This invariant is checked by cache lifecycle tests.
