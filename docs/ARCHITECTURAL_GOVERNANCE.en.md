# Architectural governance

[English](ARCHITECTURAL_GOVERNANCE.en.md) | [Italiano](ARCHITECTURAL_GOVERNANCE.md)

These rules are normative together with `ARCHITECTURE.md`.

1. One policy has one owner. Authorization, locks, concurrency, deletion and
   encryption are defined once in Domain/Application; adapters translate them.
2. Ports are complete. A lock owner is always `(userId, sessionId)` and adapters
   must not infer actor, scope or expected version information.
3. Mutations are atomic. ACL, lock, `rowVersion`, restrict, data and audit are
   checked or persisted in the same transaction.
4. PostgreSQL and SQLite preserve the same observable contract and use shared
   parity tests.
5. Compose, CI and host process managers do not define product policy or implicit
   runtime dependencies.
6. Before completion, run relevant tests including PostgreSQL integration, parity
   and E2E; configuration skips are not valid evidence.

`SqliteDatabase` owns the asynchronous connection queue.
`AttachmentApplicationService` owns attachment upload/delete and reuses ACL,
lock, version, audit and outbox policies. Blob staging precedes the final
transaction and cleanup is durable. Every audit finding requires an explicit
owner, complete port, updated call sites, parity, a negative regression test and
normative documentation.
