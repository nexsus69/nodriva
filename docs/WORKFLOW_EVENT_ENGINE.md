# Generic workflow event engine

The Workflow bounded context is a generic Core capability: it accepts events from any subject kind, not only nodes or entities. Domain models define immutable event envelopes and versioned workflow definitions; `WorkflowPlanner` is pure and deterministic. `WorkflowRepository` persists event catalogues, definitions, instances and idempotency records. PostgreSQL and SQLite adapters must preserve the same observable execution, ordering, authorization and retry outcomes.

`WorkflowEventProcessor` is the application boundary used by producers. Within a `TransactionPort` transaction it verifies that the event type is active and accepts the generic subject kind, records the event once, selects active matching definitions, and persists one plan per workflow version and event idempotency key. A duplicate event is a successful no-op and never schedules duplicate work.

`WorkflowDefinitionService` is the configuration boundary. It validates versions, nonempty/unique triggers and steps, and verifies that every trigger has a registered event contract before it writes a definition. An inactive event type may be configured in advance but cannot be processed until enabled.

The current durable records are deliberately generic:

- event catalogue: event type, allowed subject kinds and payload version;
- definition: versioned trigger, conditions and typed action inputs;
- event: immutable envelope, correlation/causation metadata and subject reference;
- execution plan: stable workflow instance key and deterministically keyed steps.

The SQLite integration test uses a custom `asset` subject and an integration actor, rather than a Nodriva node or entity. It proves that registration, configuration, planning, leasing, execution and duplicate-event suppression are reusable as a Core capability.

Events must be persisted with their business mutation and audit before delivery. Realtime is one consumer of a mutation's durable outbox; workflow planning/execution is a separate, idempotent consumer and never runs inside the write transaction. `WorkflowWorker` leases persisted steps, invokes a registered `WorkflowActionHandler`, and completes or retries the individual step with exponential backoff. A handler receives its stable `executionKey` and must pass it to downstream systems that support idempotency. Action adapters must not be embedded in a workflow definition or coupled to Pusher/realtime.

## First built-in action and operation

`audit.record` is the first internal action handler. It creates a compact
`workflow.audit.record` entry against any originating subject kind, attributed
to the original user when that actor is a Nodriva user. Its immutable trace
contains the workflow id/version, execution key and event correlation, but
never copies the event payload. Audit resource references are textual and no
longer require a new schema migration for every future module; a node scope is
linked only when the event carries a valid Nodriva UUID.

In the complete PostgreSQL deployment, the existing authenticated worker calls
`POST /api/internal/workflows/drain` alongside the realtime drain. Each call
claims at most 100 steps. `GET /api/internal/workflows/metrics`, protected by
the same deployment worker secret, exposes durable pending, leased, retrying,
oldest-pending-age and maximum-attempt measurements to Prometheus. SQLite
keeps the identical repository and worker contract; a standalone host may call
the same application service from its chosen local scheduler and requires no
new service.

## Initial producer catalog

The canonical vertical now publishes these generic contracts from its Node and
Entity application services: `record.created`, `record.updated`,
`record.deleted`, `record.restored`, and `hierarchy.moved`. They carry a
generic subject reference, type key when known, actor/session correlation,
row-version or batch metadata, and never copy a dynamic resource payload into
the workflow event. The first four accept `node` and `entity` subjects;
`hierarchy.moved` currently accepts `node`.

A subtree delete or restore has exactly one causal audit record and workflow
event: both refer to the node selected by the user, while descendants and
contained entities are immutable consequences identified by `deletionBatchId`.
The event payload contains the root identifier and affected-node count; it does
not emit one generic record event per descendant. A hierarchy move follows the
same causal rule: one `hierarchy.moved` event for the selected root, while
per-node revisions remain internal history because every descendant path and
row version changes.

The catalogue is installed idempotently by PostgreSQL migration 036 and by the
SQLite schema bootstrap. It creates no workflow definition and no external
action: authorized administrators or module installers must explicitly
configure those. The administrative application boundary requires
`system.config.read` to inspect catalogues/definitions and `system.config` to
register an event type or publish a definition. Published `(workflowId,
version)` pairs are immutable; changing a workflow means publishing a new
version, and both catalogue and definition mutations are audit logged. At most
one version of a workflow identifier is active: publishing a new active
version atomically deactivates its previously active version, while existing
plans retain the version that created them. PostgreSQL migration 038 repairs
historic duplicate active versions by retaining the greatest version; SQLite
does the same during its idempotent bootstrap. The administrator may publish
only action types installed in the deployment; the initial safe action is
`audit.record`.
Other modules use the same `WorkflowEventPublisher` port and can register a
different subject kind or event type without changes to this engine.

## Administrative experience

Workflow configuration is an administrative task, not a developer console.
The UI must present event types and installed action types through authorized
semantic catalogues (localized name, explanation and supported subject kinds),
while sending their stable technical identifiers to the application boundary.
It separates a human-readable workflow name from its immutable technical key,
guides the administrator from intent to trigger, action and optional
conditions, and retains drafts safely in the administrative workspace. New
workflow and step keys use lowercase `snake_case`; pre-existing legacy keys
remain readable and executable. A visual graph is introduced only once
branching and dependencies make a linear editor ambiguous; it is not a
substitute for validation, authorization, versioning or execution history.
The general rule, including audit filters and other admin modules, is defined
in [`ADMINISTRATIVE_UX_SEMANTIC_CATALOGS.md`](./ADMINISTRATIVE_UX_SEMANTIC_CATALOGS.md).
