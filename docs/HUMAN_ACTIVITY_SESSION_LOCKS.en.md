# Human activity, sessions and locks

[English](HUMAN_ACTIVITY_SESSION_LOCKS.en.md) | [Italiano](HUMAN_ACTIVITY_SESSION_LOCKS.md)

Session expiry is sliding and follows real human activity. Typing, input and
meaningful interactions refresh the session; passive polling and realtime do
not. The default idle timeout is 1,800 seconds and the same timing policy drives
heartbeat, lock TTL and derived intervals.

Every session and lock change must cover continuous activity, real inactivity,
background return, network errors, two sessions of one user, release and expiry.
Forms must never lose unsaved work silently. Backend session, ACL, lock and
`rowVersion` checks are authoritative; browser cache is not.

PostgreSQL and SQLite may implement timing and serialization differently, but
must preserve the same visible results, errors and ownership semantics.
