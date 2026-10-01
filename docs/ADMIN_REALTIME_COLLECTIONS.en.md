# Administrative collections and realtime

[English](ADMIN_REALTIME_COLLECTIONS.en.md) | [Italiano](ADMIN_REALTIME_COLLECTIONS.md)

Administrative realtime carries an authorized invalidation signal, not data for
direct insertion into a table. An active collection rereads its projection from
the backend. Each resource declares `realtimeDependencies`; matching events
reload only that collection while preserving query, filters, sort and page.

Unbounded collections use server pagination. The backend owns scope, filtering,
ordering, cursor/offset and counts; the browser requests only the selected
window. A bounded cache may retain visited windows but never reconstructs a
complete local dataset or decides authorization.

When realtime is disabled, the collection uses the `disabled` cache generation
and loads the requested window from the backend before a meaningful access. The
result, filters, authorization and concurrency do not change; only freshness
does.

The lifecycle preserves filters and selection, keeps old rows until an
authoritative response, coalesces nearby events, rejects stale responses and
reconciles after background return. It never overwrites a form, drawer or draft.
Audit and semantic invalidations enter the same transactional outbox and publish
only after commit.
