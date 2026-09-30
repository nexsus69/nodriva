# Audit recording policy

[English](AUDIT_RECORDING_POLICY.en.md) | [Italiano](AUDIT_RECORDING_POLICY.md)

Use cases emit an explicit semantic audit event with actor, action, resource and
before/after context. They do not decide independently whether it is retained:
all persistence goes through `PolicyAuditRecorder`.

The application policy uses an action catalogue. Unknown actions and events
classified as governance or security evidence are mandatory. Only actions
declared configurable may be suppressed. If configuration cannot be read, the
safe default retains the event.

## Relationship batches

A relationship confirmation may change several source records of one type. It
is one atomic mutation: locks, `rowVersion`, writes and audit share one
transaction. For record-level traceability, one `relationship.link` or
`relationship.unlink` event is recorded for every resource actually changed.

Several rows with the same actor and timestamp may therefore represent one
batch confirmation. The total `(timestamp, id)` ordering remains authoritative
for stable pagination.

## Normal lock activity

The **Record normal lock activity** setting (`audit.recordLockLifecycle`) is
enabled by default and controls only `lock.acquire` and `lock.release`, including
release caused by session closure. `lock.conflict` and `lock.force_release` are
always audited.

## Audit realtime invalidation

Every persisted audit event creates a generic `audit` collection invalidation in
the same transactional outbox. Producers record only the semantic event through
`PolicyAuditRecorder`; they do not publish their own audit invalidations. If the
event is suppressed, neither audit nor outbox data is written. With realtime
disabled, persistence is unchanged and no undeliverable notification is queued.

For known administrative resources, the invalidator also adds the semantic
collection signal. The worker publishes only after commit; duplicate delivery
is coalesced by the lifecycle.

Audit queries always sort by descending `(timestamp, id)`, so equal timestamps
cannot move records between pages nondeterministically.

To make another event family configurable, add an application catalogue entry,
a descriptive runtime setting and tests. Do not scatter suppression conditions
through use cases or persistence adapters.
