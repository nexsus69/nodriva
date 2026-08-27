# Architectural portability ledger

This document records the database portability boundary for Dashboard Ultimate.
It is a working guardrail for future changes and must be updated when a new
storage or messaging capability is introduced.

## Target rule

Domain and Application code must not depend on PostgreSQL, `pg`, SQL syntax,
`PgExecutor`, or framework-specific persistence APIs.

Infrastructure adapters may depend on PostgreSQL, `pg`, `ltree`, SQL and DDL.
The composition root (`packages/web/src/server/db.ts`) is responsible for
assembling concrete adapters and injecting them into application services.

## Current boundary

| Responsibility | Application contract | PostgreSQL adapter | SQLite adapter |
|---|---|---|
| Users and authentication lookup | `UserRepository` | `UserRepositoryPostgres` | `UserRepositorySqlite` |
| Sessions | `SessionRepositoryPort` | `SessionRepositoryPostgres` | `SessionRepositorySqlite` |
| Node hierarchy | `NodeRepository` | `NodeRepositoryPostgres` | `NodeRepositorySqlite` |
| Realtime node scopes | `RealtimeScopeResolver` | `RealtimeScopeResolverPostgres` | `RealtimeScopeResolverSqlite` |
| Data event delivery | `RealtimeEventBus` | `PusherEventBus` |
| Durable realtime delivery | `RealtimeOutboxPort` | `RealtimeOutboxPostgres` | `RealtimeOutboxSqlite` |
| Generic workflow catalogue and planning idempotency | `WorkflowRepository` | `WorkflowRepositoryPostgres` | `WorkflowRepositorySqlite` |
| Generic mutation-to-workflow publication | `WorkflowEventPublisher` | `WorkflowEventProcessor` | `WorkflowEventProcessor` |
| Transactions | `TransactionPort` | `TransactionPortPostgres` | `TransactionPortSqlite` |
| Dynamic type storage | `StorageTableManagementPort` | physical tables through controlled DDL | JSON payload plus relational field metadata |
| Attachments and quota | `AttachmentRepository` | `AttachmentRepositoryPostgres` | `AttachmentRepositorySqlite` |
| Upload rate limiting | `AttachmentRateLimitPort` | `AttachmentRateLimitPortPostgres` | `AttachmentRateLimitPortSqlite` |

The PostgreSQL implementation additionally materializes the assigned hierarchy
path in `node_scope_assignments.node_path`. This is an adapter-level projection
maintained by database triggers; it is not part of the application contract.

`listAncestorIds()` is a semantic repository operation. Its PostgreSQL
implementation uses `ltree`, but another database adapter must implement the
same contract with its own hierarchy mechanism.

The Web composition root selects the complete persistence profile through
`DATABASE_ADAPTER=postgres|sqlite`. SQLite is not exposed to browser code: the
frontend depends only on Server Actions and application contracts.

## Parity verification

`PersistenceAdapterParityPostgres.test.ts` executes the same observable
scenario against an in-memory SQLite database and the dedicated PostgreSQL
integration database. It compares hierarchy, entities, stale-version errors,
soft delete/restore, locks, transaction rollback, attachment quotas and rate
limits rather than requiring identical SQL or physical schemas.

`WorkflowRepository` has a shared contract suite on both adapters. It verifies
event catalogue replacement, deterministic active-definition filtering,
event/plan idempotency, durable lease transitions and operational backlog
statistics without assuming that a subject is a node or entity.

`pnpm e2e:admin-parity` extends this contract through the production Web build:
it clones `dashboard_test` into a temporary PostgreSQL database, creates a
temporary SQLite database, starts both profiles and compares the admin overview,
all admin sections, creation/detail flows and audit actions. Temporary data and
processes are removed by the script on exit.

`pnpm e2e:canonical` exercises the common project-operations vertical on both
profiles: dynamic type/field configuration, managed enum and relation values,
scoped operator access, direct out-of-scope denial, two sessions of the same
user, lock conflict, stale `rowVersion`, delete/restore and audit. The test
compares semantic outcomes, not storage layout. `pnpm e2e:parity` runs the admin
and canonical scenarios sequentially so they cannot contend for shared
administrative locks or mix audit windows. The CI job `Browser parity on SQLite
and PostgreSQL` runs the same command with a disposable PostgreSQL database and
a restricted application role.

## Forbidden dependencies

The following imports are forbidden in `domain/` and `application/`:

```text
pg
PgExecutor
infrastructure/postgres
SQL strings
Next.js, React, Pusher SDKs
```

If an application use case needs persistence behavior, add or reuse a port.
Do not import an adapter to avoid defining the contract.

## Realtime scope rule

Data events are published on shared ACL-policy channels. Scope resolution is
an infrastructure concern exposed through `RealtimeScopeResolver`; the web
layer only invokes the injected contract. The event is persisted in the outbox
inside the business transaction and delivered only after commit. Lock channels
remain separate because locks have different lifecycle and failure semantics.

The resolver must provide a safe fallback scope when an ancestor lookup fails.
Realtime delivery is best-effort after a successful database commit: delivery
errors are logged and must not roll back an already committed mutation.

## Adding another database adapter

1. Implement every required application port.
2. Preserve domain semantics, optimistic concurrency and authorization behavior.
3. Implement hierarchy queries such as `listAncestorIds()` without leaking the
   database technology into the port.
4. Provide a transaction adapter with the same commit/rollback contract.
5. Add adapter tests and integration tests against the new database.
6. Add a browser parity scenario for user-visible flows affected by the adapter.
7. Wire the adapter only in the composition root.
8. Run static checks to ensure Application and Domain do not import
   Infrastructure.

## Review checklist

- Does the changed Application file import `infrastructure/` or `pg`?
- Is a new storage behavior represented by a port?
- Are SQL/DDL and identifier escaping confined to Infrastructure?
- Are realtime failures logged with a useful fallback?
- Are committed mutations still correct when the message broker is offline?
- Does the adapter have tests for missing rows, stale versions and failures?
- Does it produce the same user-visible result in the admin parity E2E?
- If it uses dynamic table or column names, are identifiers allow-listed and
  quoted by the adapter rather than interpolated from a request?
- If it replaces `ltree` or `SKIP LOCKED`, do its ACL containment and concurrent
  outbox-claim tests demonstrate the same observable behavior?
