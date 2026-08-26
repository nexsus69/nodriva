# Generic workflow event engine

The Workflow bounded context is a generic Core capability: it accepts events from any subject kind, not only nodes or entities. Domain models define immutable event envelopes and versioned workflow definitions; `WorkflowPlanner` is pure and deterministic. Application ports will persist event catalogues, subscriptions, instances and idempotency records. PostgreSQL and SQLite adapters must preserve the same observable execution, ordering, authorization and retry outcomes.

Events are persisted with their business mutation and audit before delivery. Realtime is one consumer of this durable stream; workflow execution is a separate, idempotent consumer and never runs inside the write transaction.
