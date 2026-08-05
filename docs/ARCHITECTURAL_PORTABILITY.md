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

| Responsibility | Application contract | PostgreSQL adapter |
|---|---|---|
| Users and authentication lookup | `UserRepository` | `UserRepositoryPostgres` |
| Sessions | `SessionRepositoryPort` | `SessionRepositoryPostgres` |
| Node hierarchy | `NodeRepository` | `NodeRepositoryPostgres` |
| Realtime node scopes | `RealtimeScopeResolver` | `RealtimeScopeResolverPostgres` |
| Data event delivery | `RealtimeEventBus` | `PusherEventBus` |
| Durable realtime delivery | `RealtimeOutboxPort` | `RealtimeOutboxPostgres` |
| Transactions | `TransactionPort` | `TransactionPortPostgres` |

`listAncestorIds()` is a semantic repository operation. Its PostgreSQL
implementation uses `ltree`, but another database adapter must implement the
same contract with its own hierarchy mechanism.

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
6. Wire the adapter only in the composition root.
7. Run static checks to ensure Application and Domain do not import
   Infrastructure.

## Review checklist

- Does the changed Application file import `infrastructure/` or `pg`?
- Is a new storage behavior represented by a port?
- Are SQL/DDL and identifier escaping confined to Infrastructure?
- Are realtime failures logged with a useful fallback?
- Are committed mutations still correct when the message broker is offline?
- Does the adapter have tests for missing rows, stale versions and failures?
