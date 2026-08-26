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

## Initial producer catalog

The canonical vertical now publishes these generic contracts from its Node and
Entity application services: `record.created`, `record.updated`,
`record.deleted`, `record.restored`, and `hierarchy.moved`. They carry a
generic subject reference, type key when known, actor/session correlation,
row-version or batch metadata, and never copy a dynamic resource payload into
the workflow event. The first four accept `node` and `entity` subjects;
`hierarchy.moved` currently accepts `node`.

The catalogue is installed idempotently by PostgreSQL migration 036 and by the
SQLite schema bootstrap. It creates no workflow definition and no external
action: administrators or module installers must explicitly configure those.
Other modules use the same `WorkflowEventPublisher` port and can register a
different subject kind or event type without changes to this engine.
