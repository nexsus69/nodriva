# Component → view → cache → backend standard

This standard defines the frontend data path. Components render typed props and
must not import repositories or infrastructure adapters. A view coordinator
reads the semantic cache, fetches missing or stale data through a Server Action
or API, and delegates authorization, validation, session and scope checks to the
application service. The repository and database remain behind that boundary.

The coordinator owns loading, error and stale transitions; shared form,
pagination and invalidation behavior must be implemented once and covered by
focused tests. Realtime events invalidate or refresh the read model only after
the backend has accepted the mutation.
