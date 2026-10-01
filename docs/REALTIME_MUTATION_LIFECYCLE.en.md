# Realtime mutation lifecycle

[English](REALTIME_MUTATION_LIFECYCLE.en.md) | [Italiano](REALTIME_MUTATION_LIFECYCLE.md)

Node/entity mutations persist the data and its event in the same PostgreSQL
transaction. After commit, the action starts a best-effort outbox drain; the
response does not depend on Pusher availability.

Data events use shared policy channels:

```text
private-realtime-policy-{policyHash}-data
```

The server resolves the parent node and all ancestors, applies allow/deny and
publishes to every policy containing the resource. Moves also consider the
ancestors of the previous position. The frontend lets the invalidation
coordinator decide whether to update the read model, invalidate a view or
ignore an event already superseded by `rowVersion`.

## Single client invalidation protocol

Local mutations and external realtime events converge on the same semantic
event (`resourceType`, `resourceId`, `changeType` and optional
`affectedResourceIds`). `ResourceCacheInvalidationCoordinator` applies effects
on normalized records, child lists, hierarchies, subtree views and entity
membership in one place. A realtime event produced by the local session can be
ignored without losing invalidation because the local response already passed
through that coordinator. Components and actions must not choose a cache to
invalidate directly.

Lock channels remain separate from data: their frequency, lifecycle and error
semantics differ from data events.

## Shared policy channels

The realtime channel is not built by the client and does not represent only a
node. The server calculates the effective ACL policy (allow minus deny),
normalizes it and identifies it with a hash. Users with the same policy share a
channel:

```text
private-realtime-policy-{policyHash}-data
private-realtime-policy-{policyHash}-locks
```

The client receives channel names from a Server Action and may subscribe only
to those names. The server-side router evaluates every event against all
policies and publishes only to authorized channels. An event under `NodeC` is
therefore sent to `NodeA subtree allow`, but not to `NodeA subtree allow +
NodeC subtree deny`.

The Pusher authorization route checks the channel again against the user's
current policy. The Pusher connection is also authenticated with the
application user: a scope, role or user-state change invalidates the cache
after commit and terminates that user's connections, requiring subscription
authorization again. The client reconciles channels and virtual roots at an
interval derived from session duration (currently 300 seconds with the default
30-minute timeout) as a safety net for providers that cannot terminate users.
This reconciliation is passive and does not renew the session.

## Guaranteed sequences

### Creation

```text
authorize placement -> create -> data:changed(created) -> response
```

Creation does not acquire a lock or check the container node's `rowVersion`.
The parent reference verifies scope and authorization and directs invalidation
and notification of the new item beneath it.

### Update

```text
lock (authenticated session) -> update -> data:changed(updated) -> response -> unlock (UI)
```

The mutation response is authoritative for the session that saved. Every
browser mutation generates a `mutationId`; the backend stores it in the outbox
event together with `eventId`, `resourceVersion` and origin session. The client
applies the local response once and treats a realtime event with the same
`mutationId` as confirmation, not an external change. Events from another
origin session update the cache and may make an open form stale. `eventId`
deduplicates delivery of the same event, while `mutationId` correlates delivery
with the operation that produced it; the identifiers are not interchangeable.

Update does not release the lock automatically: it may protect an edit mode
with several saves. The lock belongs to the exact authenticated session, not to
the user generically, and is renewed only by human activity in that session. It
is released when leaving edit mode, unmounting the component or logging out;
TTL and session cascade remain server-side guarantees.

### Move

```text
lock (authenticated session) -> move -> data:changed(moved) -> response -> unlock (UI)
```

The event includes the new container and, when available, the previous
container, so affected caches can update both views.

### Delete

```text
lock (optional) -> delete -> data:changed(deleted) -> automatic unlock -> response
```

Automatic release prevents an orphaned lock on a resource that no longer
exists. If release fails, lock TTL remains the fallback and deletion is not
cancelled.

The complete activity, timeout and lock ownership contract is described in
[`HUMAN_ACTIVITY_SESSION_LOCKS.md`](./HUMAN_ACTIVITY_SESSION_LOCKS.md).

## Realtime disabled

With runtime capability `realtime` disabled, the server bus does not publish
Pusher events and actions continue to execute mutations normally. With
`NEXT_PUBLIC_REALTIME_ENABLED=false`, the client opens no subscriptions and the
authorization route responds with `503`.

Publication is at-least-once through `realtime_event_outbox`. Each worker
claims rows with a PostgreSQL lease (`FOR UPDATE SKIP LOCKED`); failures use
exponential backoff and do not make an already persisted mutation fail. An
authenticated job must call `POST /api/internal/realtime/drain` with
`Authorization: Bearer $REALTIME_WORKER_SECRET` to drain the outbox even when no
new mutations arrive.

In the reference/test Compose profile with the realtime overlay,
`realtime-worker` makes that call every five seconds and also drains registered
workflow actions. Set the same `REALTIME_WORKER_SECRET` in Web and Compose. The
worker is optional and defined by `docker-compose.realtime.yml`; when it is not
running, asynchronous effects remain in the durable queue. Deployment must set
`REALTIME_DRAIN_URL` to the worker endpoint and, for a containerized Web, to the
internal DNS name and configured `DASHBOARD_WEB_PORT`.

Ancestor resolution uses the PostgreSQL repository and `ltree`. If it fails,
the error is recorded and the event keeps only direct scope: this conservative
choice avoids widening visibility. Data remains correct; the worker retries
delivery without recalculating a potentially broader scope.

## Operations

`GET /api/internal/realtime/metrics` exposes Prometheus metrics protected by the
same worker secret. Metrics are local to the process; a multi-instance
deployment must collect them from every replica.

In the reference/test Compose profile Prometheus is supplied only by the
optional `docker-compose.monitoring.yml` overlay. Alert on backlog age, retries,
repeated attempts and publish failures. Add a target for each Web replica to
the `dashboard-web-realtime` job (or run a Prometheus replica per network/host);
the endpoint remains protected by `REALTIME_WORKER_SECRET`.

The `dashboard-web-workflow` job separately collects
`GET /api/internal/workflows/metrics`: this is a persistent backlog, not a
metric local to one instance. The same worker calls
`POST /api/internal/workflows/drain`; both routes require the worker bearer
secret and are not user endpoints.
