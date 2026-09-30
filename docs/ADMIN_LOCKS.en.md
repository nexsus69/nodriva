# Administrative locks

[English](ADMIN_LOCKS.en.md) | [Italiano](ADMIN_LOCKS.md)

Administrative detail pages use the same primitive as nodes and entities:
`LockService` persists locks in PostgreSQL, publishes Pusher events on authorized
channels, and applies TTL, heartbeat and session ownership.

## Protected resources

- `user`
- `role`
- `scope_assignment`
- `node_type`
- `entity_type`
- `system_setting`
- `runtime_capability`
- `placement_policy`

Administrative mutations acquire the lock after the ACL check and release it in
a `finally` block. `rowVersion` is a second barrier: a stale form is rejected
even when the lock has already been released.

## UI behavior

Detail pages show the lock owner, resource state and acquire/release commands. A
lock held by another session disables the operation, while the backend continues
to reject every unauthorized mutation.

## Minimum verification

1. Open the same administrative detail in two sessions.
2. Acquire the lock in the first session.
3. Check the blocked state and realtime event in the second session.
4. Attempt a mutation from the second session: it must return `LOCK_CONFLICT`.
5. Release the lock and retry: the mutation must succeed only with a current
   `rowVersion`.
6. Check `lock.acquire`, `lock.conflict` and `lock.release` in audit when normal
   lock lifecycle recording is enabled. Conflicts and administrative releases
   are always recorded.

Core tests cover ownership, conflicts, audit and administrative channel routing.
Browser tests must use authenticated, non-expired sessions. `pnpm e2e:admin-parity`
also checks equivalent results on SQLite and PostgreSQL; `pnpm e2e:canonical`
checks real contention between two sessions and rejection of a stale version.

The central policy decides which lifecycle events are retained without changing
lock or realtime semantics; see [audit policy](AUDIT_RECORDING_POLICY.en.md).
