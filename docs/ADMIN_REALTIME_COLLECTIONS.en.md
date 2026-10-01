# Administrative collections and realtime

## Contract

Administrative realtime carries an authorized invalidation signal, not data to
insert directly into a table. An active collection always rereads its own
projection from the backend.

Each administrative resource declares `realtimeDependencies` in its list
contract. When a realtime event invalidates a matching dependency, the shared
lifecycle reloads only that collection.

A collection implements the contract through its own hook/controller:

```ts
const REALTIME_DEPENDENCIES = ["audit"] as const;

useAdminRealtimeCollectionRefresh(
  REALTIME_DEPENDENCIES,
  () => loadCurrentData(),
);
```

`loadCurrentData` is the same authoritative read used for the initial load and
manual refresh; it preserves the current filters, ordering and page. The
component does not publish realtime events or interpret domain payloads: it only
declares the semantic collections it depends on. If a resource has not yet
been mapped to a collection key, add the mapping once in `GlobalCacheClient`,
with authorization and invalidation tests, before using the dependency in a
component.

## Paginated windows and anchoring

An administrative collection that can grow without a fixed bound—user-created
data, operational resources, users, assignments, recycle bin, audit or
workflows—uses remote pagination. The backend owns scope, filters, ordering,
cursor or offset and the count needed for navigation; the browser requests only
the selected window. It must not walk every backend page to build a local list
and apply visual pagination afterwards.

The cache may retain an explicitly limited number of visited windows, identified
by the authoritative query and page or cursor. It must not merge them into a
complete dataset in the collection controller. The common `PagedWindowCoordinator`
owns only LRU, resource-to-window indexing, request deduplication and dropping
responses from an older generation. Each catalogue coordinator instead owns
query normalization, the authorized read port, projection into the cache kernel
and its realtime impact policy: the primitive never decides authorization,
filters or cache contents. Small finite semantic catalogues may use client
pagination only when their owner documents that limit.

After a page change, the activated pagination control remains visible and
receives focus. A height change, including a shorter final page, must not move
the menu outside the viewport or leave focus on a removed element. The
controller preserves query, page and compatible selection; the shared component
owns anchoring rather than each screen implementing it independently.

Test the first page without a full load, forward/back navigation, an incomplete
last page, cache retention and eviction, filter or ordering changes, realtime
refresh of the same query and SQLite/PostgreSQL parity.

## Realtime capability disabled

Realtime is optional. When deliberately disabled, as in the standalone SQLite
profile, the collection continues in the `disabled` cache generation: before a
meaningful logical access it loads the requested window from the backend. It
must not show an error, open channels, call realtime authentication endpoints
or treat missing invalidations as a failure.

Only update timeliness changes; read results, filters, authorization and
concurrency do not. Test both the path receiving an invalidation and the path
with the capability disabled and an authoritative window reload.

## Interaction guarantees

- current filters, ordering and page survive a reload;
- previous rows remain visible until the authoritative response;
- close events are coalesced;
- an older response cannot overwrite a newer reload;
- in the background, the collection is marked stale and realigns on return;
- a list never overwrites a form, drawer or draft: details retain their own
  lock and `rowVersion` contract.

Authorization remains in the backend and Pusher routing: the browser reacts
only to events already delivered on authorized channels and never derives
visibility from a realtime payload.

Administrative mutations do not depend on a second transaction for notification.
`PolicyAuditRecorder` persists audit and administrative-collection invalidations
in the same transactional outbox; the worker publishes them only after commit.
Duplicate delivery is allowed and coalesced by the lifecycle, while loss of the
authoritative signal is not.
