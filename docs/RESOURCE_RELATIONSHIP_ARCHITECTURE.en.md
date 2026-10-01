# Resource relationship architecture

Relationships are typed, scoped links between resources. The application layer
validates cardinality, target type, visibility and deletion policy before the
repository writes the relation. PostgreSQL and SQLite adapters may persist links
differently but must return the same ordering, errors and authorization result.
