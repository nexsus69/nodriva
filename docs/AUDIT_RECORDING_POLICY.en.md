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
`relationship.unlink` event is recorded for every resource actually changed,
with its before/after snapshot.

Several rows with the same actor and timestamp may therefore represent one
batch confirmation. The total `(timestamp, id)` ordering remains authoritative
for stable pagination.

## Normal lock activity

The **Record normal lock activity** setting (`audit.recordLockLifecycle`) is
enabled by default and controls only `lock.acquire` and `lock.release`, including
release caused by session closure. It does not change persistence, TTL,
ownership, `rowVersion`, release semantics or realtime notifications.
`lock.conflict` and the administrative `lock.force_release` mutation are always
audited.

## Audit realtime invalidation

Every persisted audit event creates a generic `audit` collection invalidation in
the same transactional outbox. Producers (locks, workflows, attachments and
resource mutations) record only the semantic event through
`PolicyAuditRecorder`; they do not publish their own audit invalidations. If the
event is suppressed, neither audit nor outbox data is written. With realtime
disabled, persistence is unchanged and no undeliverable notification is queued.

For known administrative resources, the same invalidator also adds the semantic
collection signal (`user`, `role`, `scope`, types or `system`). Audit and all
authoritative signals enter the mutation transaction together. The worker
publishes only after commit and duplicate delivery is coalesced by the
lifecycle. Legacy post-commit publication remains only a compatible
acceleration; its failure cannot turn an already committed mutation into an
application error.

Audit queries always sort by descending `(timestamp, id)`, so equal timestamps
cannot move records between pages nondeterministically.

To make another event family configurable, add an application catalogue entry,
a descriptive runtime setting and tests. Do not scatter suppression conditions
through use cases or persistence adapters.
