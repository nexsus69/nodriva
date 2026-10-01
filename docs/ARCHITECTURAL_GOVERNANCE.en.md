# Architectural governance

This document is normative together with `ARCHITECTURE.md`. A change that
violates these rules is not ready for merge, even when it compiles.

## Binding rules

1. **One policy, one owner.** Authorization, lock ownership, concurrency,
   deletion policy and encryption are defined once in Domain or Application.
   Adapters translate the contract and do not introduce alternative criteria.
2. **Complete contracts.** A port receives every policy input. A lock owner is
   always `(userId, sessionId)`, never only the user.
3. **Atomic mutations.** `rowVersion`, lock, ACL and restrict are checked in
   the same transaction and, when they condition a write, in the same atomic
   operation.
4. **Adapter parity.** PostgreSQL and SQLite may differ internally but must
   produce the same outcomes, errors, ordering, rollback and constraints.
5. **Deployment is not product.** Compose, CI and local hosts do not
   define Nodriva policy or implicit runtime requirements.
6. **Complete local suite.** Before declaring work complete and before every
   push, run all relevant tests, including PostgreSQL integration, contract,
   adapter parity and E2E. PostgreSQL tests use only the isolated database
   created by `pnpm test:postgres:local`; a configuration skip is not valid
   evidence.

## Required checklist

### SQLite connection ownership

`SqliteDatabase` owns the single-connection asynchronous access queue. Every
asynchronous adapter method and application transaction enters that same
reentrant queue. Synchronous adapter helpers may run only while the connection
is idle or inside their owning asynchronous context; unrelated synchronous
access fails before executing SQL. Ownership expires when work completes,
including detached callbacks. After-commit effects run after ownership is
released. This protects sessions, workers and reads as well as mutations.

### Attachment mutation ownership

`AttachmentApplicationService` owns upload and deletion in the
Entity/Governance application boundary. It depends on application ports and the
existing lock policy, never HTTP or SQL. Commands carry authenticated
user/session identity and expected aggregate version. With locking enabled, an
existing resource requires an owned lock, including uploads immediately after
creation; the client acquires and releases that lock explicitly.

Blob staging and scanning precede the final transaction. That transaction
repeats ACL, field and security-policy checks, verifies lock ownership and
conditionally advances the aggregate version, then persists attachment
metadata, audit and realtime outbox together. A changed security policy rejects
the staged upload. Blob cleanup and delivery occur after commit. Responses
return the resulting aggregate version so multiple uploads can chain
conditional writes without silently refreshing away a stale form. Routes only
decode HTTP and map outcomes.

For every change declare policy owner, port, call sites, adapter and parity
tests. Before merge, verify indirect call sites, negative divergence tests,
rollback and `git diff --check`.

## Audit closure protocol

A cross-cutting audit finding cannot be marked “Resolved” merely because the
main case works. Closure requires:

- an explicit application owner for the policy;
- a complete port, with no missing parameters that force adapters to reinterpret
  the rule;
- all known call sites updated or explicitly declared uninvolved;
- observable PostgreSQL/SQLite parity whenever the behavior is common;
- at least one negative test that fails if the old deviation returns;
- updates to the relevant normative documents with criterion and outcome.

If a policy remains duplicated in multiple places, the finding stays open even
when a single screen or endpoint appears correct.
