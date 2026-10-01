# Known trade-offs

[English](known-tradeoffs.en.md) | [Italiano](known-tradeoffs.it.md)

This document records accepted architectural trade-offs that may be optimized
later without changing current invariants.

## Invalidation by face of an extensible resource

Entities, nodes and similar resources have a common part and specialized faces,
such as dynamic payload, relationships and attachments. The aggregate
deliberately keeps one authoritative `rowVersion` for locks, conditional writes
and conflicts: every face change must prevent saving an older copy.

The cache may therefore invalidate a projection broader than necessary when only
a dynamic field changes while a list uses common name and metadata. This is an
accepted efficiency cost, not a correctness defect or prerequisite of the
current vertical.

When measured load justifies it, introduce `ResourceChangeDescriptor`: the
mutation continues to update only `rowVersion` while declaring changed faces. A
cache policy can then invalidate only projections depending on those faces. The
first pilot should cover common/dynamic entity faces and test unchanged
concurrency, common-list cache hits and detail refresh before extending to
relationships and attachments.

## Complex frontend coordinators

Refactoring made `page.tsx` and `layout.tsx` thin composition boundaries and
separated screens, sections and hooks/controllers. File size alone is not a
defect: refactoring follows observable responsibilities and invariants while
preserving session/lock, scroll/resize and navigation/realtime tests. The
automatic 60-line limit applies to routes, not these controllers.

The `ActivityProvider` finding is resolved: the component composes a controller,
while reducer, temporal lock gate/registry, HTTP protocol and browser binding
have independent modules and tests. The observable sliding-session and lock
renewal contract is unchanged.

`VirtualGroupedTable` is likewise split into a UI controller and presentation
body; grouping, selection, sentinel gate, observer binding and scroll
compensation are isolated and tested. The paginated window remains governed by
semantic cache and `useVirtualSubtreeData`, without a second local window.

`NodeTree` now composes the expanded-state controller and recursive branch.
Loading remains lazy through `useSemanticNodeList` and the canonical record
comes from `useCachedNode`; tests cover expansion, selection, loading and
realtime without a second cache.

## Read access control and LTree subquery

PostgreSQL read filtering is centralized in
`AccessControlPortPostgres.getReadAccessControlSql`. Migration
`004_materialized_scope_node_path.sql` adds `node_path` to
`node_scope_assignments`, maintains it with triggers and lets the ACL adapter
use `nsa.node_path @> target.path` directly, supported by GiST indexes. The
redundancy is valid only because the database updates it in the same
transaction; the application layer must not update it.

Direct navigation and virtual roots apply `node.read` in a set-based PostgreSQL
query. The LTree subquery optimization is therefore closed by the materialized
path.

## Stateful session storage

The platform uses `user_sessions` with an opaque token in the cookie. A primary-
key lookup is negligible compared with LTree ACL queries and enables immediate
server-side revocation, unlike JWT without a denylist. Each lock is tied to the
exact session through `session_id`; logout and session deletion provide explicit
release and a security cascade.

The original token remains only in the HTTP-only cookie.
`AuthApplicationService` computes its SHA-256 hash before storage and compares
the hash during session resolution and logout; a database dump exposes no usable
tokens.

## 401 interception

`AppCache` intercepts 401 errors both in aggregations handled by
`FetchCoordinator` and in detail mutations/fetches handled by
`GlobalCacheClient`. HTTP calls outside the Semantic Cache Engine are not
automatically covered; the UI contract therefore requires `AppCache` primitives,
which guarantee immediate purge and client hardening.
