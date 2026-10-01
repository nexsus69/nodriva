# Workflow event engine

The event engine records domain events and evaluates configured workflows after
the owning transaction commits. Event names and actions come from authorized
catalogs; technical keys are not free-form UI input. Retries are idempotent,
audited and bounded, while failures remain visible to operators.
