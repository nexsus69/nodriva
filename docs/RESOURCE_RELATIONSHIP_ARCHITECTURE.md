# Resource relationship architecture

## Status

This document defines the target contract for typed relationships between
Nodriva resources. It replaces the former assumption that a `relation` field
is only a UUID stored in a resource payload.

## Placement

| Concern | Bounded context | Layer | Transaction phase |
| --- | --- | --- | --- |
| Relation definition and cardinality | Type System | Domain/application DTO | Metadata transaction |
| Relation edge lifecycle | Entity Domain / Hierarchy | Application service | Resource transaction |
| Relation edge persistence | Relationship infrastructure | Infrastructure adapter | Resource transaction |
| Audit and realtime events | Governance | Application/infrastructure | After edge persistence, before commit / after commit |
| Relation editor and inverse panel | Frontend Read Model | Presentation | Client only |

The relationship application service may depend on resource repositories,
type-definition readers, authorization, locks, audit, revision, transaction
and a `ResourceRelationshipRepository` port. It must not depend on SQL,
framework code, or UI state. PostgreSQL and SQLite adapters implement the
same port.

## Definition contract

Each `relation` field defines:

- a source resource type and field key;
- a target resource type;
- source cardinality: `one` or `many`;
- optional target uniqueness, which makes the target side `one` and therefore
  enables a strict one-to-one relationship when source cardinality is `one`;
- an optional inverse label for the generated incoming relationship panel;
- an explicit deletion policy. The initial supported policy is `restrict`.

Existing fields migrate with source cardinality `one`, target uniqueness
`false`, and deletion policy `restrict`. Their observable form value remains a
single resource identifier until a field is deliberately changed to `many`.

## Canonical data and compatibility

`resource_relationships` is the canonical relationship store. A row is an
edge identified by its source field, source resource and target resource. The
table also retains the resource domains, so node and entity identifiers cannot
be confused.

During the compatibility migration existing relation columns/payload values
are retained only as read compatibility data. Application mutations write the
canonical edge first in the same transaction and project it to legacy storage
only while that storage is required by an older dynamic schema. New reads are
hydrated from the canonical edges. No UI component reads or writes the legacy
representation directly.

## Mutation contract

The application layer exposes a single set of operations: replace outbound
values, link, unlink, reorder, and bulk link/unlink from the inverse side.
Every operation validates source/target type, actor visibility and scope,
source row version and cardinality. It writes the affected edge rows, resource
revision and a complete audit record in the same transaction.

Ordinary form edits require the actor to own the resource lock when locking is
enabled. An inverse bulk operation has no per-source edit surface, so it uses
the deliberate batch policy: it refuses any source locked by another session
and checks every submitted row version. This prevents overwriting an open form
while allowing a user to link one resource to many sources without opening and
locking each one separately.

Bulk operations use an explicit two-step protocol:

1. `RelationshipMutationPlanner` validates the requested source/target,
   authorization and submitted source versions and produces a non-durable
   `RelationshipMutationPlan`.
2. The UI presents the calculated effects. In particular, changing an existing
   single-value relation is a `replace`, never an implicit `link`; the actor
   must explicitly confirm every replacement.
3. `ResourceRelationshipMutationService` prepares the plan again inside one
   transaction. `BatchMutationConcurrencyGuard` rejects sources actively
   locked by another session, then `RelationshipMutationCommitter` delegates
   writes to `ResourceRelationshipMutationWriter`.

The plan is deliberately a preview, not a long-lived reservation or a second
cache. It is not persisted because no UI action may rely on a stale plan:
commit re-reads the source rows, rechecks ACL, locks, cardinality and every
`rowVersion`. PostgreSQL obtains normal short write locks during the atomic
updates; SQLite serializes its transaction on the standalone connection. The
observable contract is the same: a concurrent change makes the complete batch
fail rather than allowing a partial or silent overwrite.

Bulk operations are all-or-nothing by default. The command carries the
expected row version for every affected source; a stale, locked or unauthorized
member rejects the complete request rather than partially changing one hundred
resources. A future explicit best-effort command may return per-resource
outcomes, but must not silently weaken this default.

## Presentation contract

`RelationEditor` renders a field according to the metadata: a single
candidate selector for `one`, and an ordered multi-select for `many`.
`RelationPanel` is generated from the same metadata on a resource detail
surface and lists both outgoing and incoming edges. Its inverse bulk action
first requests the common server preview, then invokes the common server
command only after the review step. It never edits another resource's cached
payload locally or infers replacement semantics from client data.

All relationship candidates, labels and inverse rows are ACL-filtered on the
server. Cache updates and realtime notifications use canonical resource
identifiers and do not infer relationship completeness from a view.

## Verification requirements

Every relationship change requires SQLite/PostgreSQL contract coverage for
cardinality, target type validation, authorization, deletion policy, audit,
row-version conflicts and rollback. Unit tests cover each pure relationship
impact and the confirmation gate independently. Browser E2E covers a relation
created from both the source editor and inverse panel, including replacement
review, reload and realtime propagation when enabled.
