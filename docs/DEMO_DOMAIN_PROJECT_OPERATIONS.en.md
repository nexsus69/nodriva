# Canonical project-operations vertical

[English](DEMO_DOMAIN_PROJECT_OPERATIONS.en.md) | [Italiano](DEMO_DOMAIN_PROJECT_OPERATIONS.md)

The project-operations scenario is the canonical acceptance vertical. It
demonstrates generic nodes, types, entities, relationships, scopes and
attachments without turning Nodriva into a domain-specific product.

The scenario includes a hierarchical organization, projects and milestones,
dynamic types for project briefs, tasks and documents, a task dependency
relationship, an operator with role and scope, two-session locks and
`rowVersion`, attachment lifecycle, deletion/restore, audit and optional realtime.

New installations use only the additive administrative bootstrap: no demo nodes,
entities or application types are created at startup. Development and E2E
fixtures provision their own isolated data. Historical reset instructions are
obsolete and must never target production.
