# Architectural portability

Domain rules are independent of frameworks, SQL and infrastructure. Application
services orchestrate use cases through ports; adapters implement those ports.
PostgreSQL and SQLite may use different storage techniques only when observable
contracts, errors, authorization, rollback and versioning remain equivalent.

New providers require a concrete vertical use case, parity tests and an explicit
operational owner.
