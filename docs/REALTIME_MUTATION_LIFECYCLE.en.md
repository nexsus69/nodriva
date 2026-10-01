# Realtime mutation lifecycle

Node and entity mutations persist the data and its event in one PostgreSQL
transaction. After commit, the action performs a best-effort outbox drain; the
response does not depend on Pusher availability.

Events use policy-scoped channels such as
`private-realtime-policy-{policyHash}-data`. The server resolves the parent and
ancestors, applies allow/deny rules, and publishes to every policy containing
the resource. Moves also evaluate the previous ancestors. The frontend lets
the invalidation coordinator refresh or invalidate its read model and ignores
events already superseded by `rowVersion`.
