# Human activity, sessions and locks

[English](HUMAN_ACTIVITY_SESSION_LOCKS.en.md) | [Italiano](HUMAN_ACTIVITY_SESSION_LOCKS.md)

This document describes the shared client/server contract for inactivity,
authenticated-session renewal and edit locks.

## One temporal configuration

During testing, the timing source is
`packages/web/src/config/runtimeTiming.ts`. The only configurable value is
temporarily `NEXT_PUBLIC_SESSION_IDLE_TIMEOUT_SECONDS`; all other intervals are
derived. Do not introduce hardcoded application timers for session, heartbeat,
lock or polling.

Before production, duration must become an authoritative backend configuration
that can change at runtime and reach the client without a rebuild. Applicable
checks are summarized in the acceptance checklist and repository development
procedures.

With the current default of 1800 seconds:

| Concept | Derivation | Current value |
| --- | --- | ---: |
| Maximum session inactivity | configuration | 1800 s (30 min) |
| Heartbeat throttle | session / 6 | 300 s (5 min) |
| Reconciliation polling | session / 6 | 300 s (5 min) |
| Lock TTL | 2 × heartbeat | 600 s (10 min) |

PostgreSQL and SQLite seeds use the same default. Migration
`033_session_idle_timeout_30_minutes.sql` also aligns existing PostgreSQL
installations.

Lock TTL is therefore shorter than the session. In normal inactivity, when a
session expires it cannot still have one of its locks active: the last lock has
already expired. A stale row may remain temporarily in the database, but is not
considered valid and can be overwritten.

## Human activity and heartbeat

The client considers `pointerdown`, `keydown`, `input` and `wheel` human
activity, including events from scrollbars and overlay panels. When the page is
visible, the first event after the throttle window sends `POST /api/activity`.

The server uses identity resolved from the session, never identity data supplied
by the client, and in one transaction:

1. extends the expiry of the specific authenticated session;
2. extends only locks registered as active in the client and owned by that same
   session, up to the derived TTL;
3. returns the new session expiry and the list of locks actually renewed.

A network or server error does not prove that the session expired. Only a `401`
or an authoritative negative check moves the client to `Session expired`,
clears cache and stops polling, realtime and activity listeners.

The same distinction applies in Auth.js JWT callback: only `AUTH_UNAUTHORIZED`
removes persisted session identity from the signed token. An infrastructure
error preserves already-signed claims and lets the next request retry
verification. This does not extend the database session; after recovery, a
session that truly expired in the meantime is still rejected and invalidated.

## Background and expiry checks

Browsers, especially mobile browsers, may suspend timers and networking while a
page is in the background. The system therefore does not rely on a client timer
to expire the session: authoritative expiry is in the database.

When the page becomes visible, `GET /api/activity` checks state without renewal.
The local watcher performs the same check shortly after the known expiry; when
the network is unreachable it retries instead of falsely declaring the session
expired.

## Polling and realtime

`GET /api/sync/access` passively reconciles realtime channels, scope and virtual
roots. It is not human activity and renews neither session nor lock. Realtime
remains primary; polling recovers lost permission or subscription changes and
also runs when the page returns to the foreground.

## Lock ownership

Every lock contains both `user_id` and `session_id`. Ownership belongs to the
specific authenticated session:

- two tabs sharing one browser session share ownership;
- another device or login by the same user has a different session and sees the
  lock as owned by someone else;
- every protected mutation checks both user and session on the server;
- realtime events and client cache retain `sessionId`, so a delayed release by
  an old session cannot remove a lock acquired meanwhile by another.

Leaving edit mode attempts explicit release. Explicit release is not skipped
when local cache temporarily shows no lock: backend verifies session and
ownership. Cache is a UI indication, not the authority deciding whether to send
the release command.

Voluntary logout releases and publishes events for every lock in the session
before deleting the session. Foreign key
`locks.session_id -> user_sessions.id ON DELETE CASCADE` is the final guarantee
for revocations, errors and administrative paths. On inactivity expiry, the
shorter lock TTL remains the normal safety mechanism.

A lock protects only the existing resource being edited. Creating an entity or
child node does not acquire, check or renew a lock on the containing node and
does not require its `rowVersion`: `parentNodeId` is a placement and
authorization reference, not a modified record. Multiple authorized sessions
may therefore create items in the same container concurrently. Container
authorization, new-resource transaction, audit and its realtime notification
remain mandatory.

Restoring from the recycle bin is a protected mutation but does not start from
an edit page. The server action checks permission on the deleted record,
acquires a transient lock for the session, performs restore and `rowVersion`
check, then releases the lock in `finally`. Concurrent restores cannot cross
the application boundary together and an error leaves no administrative lock.

The same rule applies to deletion from a resource menu: the client may supply
only the UUID. The server action rereads the record, checks delete permission,
gets the current `rowVersion` and, when locking is enabled and the session does
not already own the lock, acquires it only for the mutation. The temporary lock
is released after success and on error; another user's lock still produces a
conflict.

## Unsaved changes

Workspace and Admin create/edit forms register a guard only when their value
differs from persisted data or contains new attachments. The guard covers Next.js
links, known imperative navigation, logout, refresh and tab close; browsers
exposing the Navigation API also cover back/forward.

Local cancellation asks for confirmation before clearing the form or releasing
the lock. A validation, network or persistence error keeps both draft and lock.
After a successful save, the new version becomes the baseline and application
navigation can proceed without a false warning.

Emergency lock release uses `pagehide`, not `beforeunload`, so a user who
cancels leaving the page retains the lock for their session. React cleanup still
releases it on client-side navigations that actually complete.

## Diagnostics

With `NEXT_PUBLIC_ACTIVITY_DEBUG=true`, the Activity/Sync panel shows detected
activity, heartbeat, known expiry, polling, registered locks and related errors.
The panel is observability: interacting with it counts as normal human
activity, but does not directly modify session or locks.
