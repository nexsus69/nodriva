# ARCHITECTURE.md

> **Status: normative for the current implementation.** When this document,
> `docs/`, and a historical document disagree on runtime architecture,
> contracts, persistence, realtime, or security behavior, this document and
> the relevant operational document in `docs/` take precedence. Historical
> requirements remain product input and must be reconciled explicitly before
> changing the runtime contract.

## Purpose

This document freezes the architectural layer map, dependency rules, and placement rules for Dashboard V2 so that new implementation work does not continuously reopen already-settled structural decisions. The goal is to define where each responsibility belongs before coding, reducing design loops and preventing accidental leakage of infrastructure concerns into application or domain code.[cite:13][cite:30]

Dashboard ultimate is intended to be a modular monolith with clear internal boundaries, dynamic type definitions, dedicated relational tables, runtime schema reconstruction, and a configurable frontend/read-model layer rather than a fixed UI layout.[cite:26][cite:10][cite:11]

## Core principle

Dependencies must always point inward: presentation depends on application contracts, application depends on domain and ports, and infrastructure implements ports without becoming the source of business rules.[cite:100][cite:30]

A section is considered truly closed only when its cross-cutting placement is also frozen: bounded context, layer, allowed dependencies, forbidden dependencies, and post-commit side effects. This document exists to make those boundaries explicit.[cite:13]

## Bounded contexts

| Context | Responsibility |
|---|---|
| Hierarchy | Nodes, parent/child structure, movement in the tree, subtree semantics |
| Type System | NodeType, EntityType, fields, constraints, runtime schema reconstruction, type administration |
| Entity Domain | Entity instances, typed payload validation, CRUD orchestration |
| Relationships | Typed resource edges, cardinality, inverse projections and deletion policy |
| Identity & Access | Users, roles, scopes, sessions, authorization |
| Governance | Audit, revisions, locking, optimistic concurrency |
| Frontend Read Model | Normalized client store, page-based cache, view composition data |
| Administration | System configuration, capabilities, runtime profile selection |

These bounded contexts are stable reference zones even when concrete classes, adapters, or tables evolve.[cite:30][cite:11]

## Technical layers

### Domain

**Purpose:** hold business concepts, invariants, value rules, and semantic errors without dependency on frameworks, transport, or storage.[cite:100][cite:30]

**May depend on:** nothing external.

**Allowed:** domain models, value objects, pure validation rules, domain errors.

**Forbidden:** SQL, `pg`, HTTP, framework APIs, cache access, schema compilation with DB coupling, UI concerns.

**Examples:** `ManagedTypeDefinition`, `ManagedTypeField`, `ManagedTypeFieldConstraint`, `TypeAdminErrors`, `SchemaErrors`.

### Application

**Purpose:** orchestrate use cases and coordinate domain objects with ports. This layer owns commands, application services, transaction orchestration, post-commit sequencing, and high-level validation flow.[cite:32][cite:13]

**May depend on:** Domain and application ports.

**Allowed:** services, use cases, commands, DTOs, ports, orchestration logic, transaction boundaries, post-commit invalidation triggers.

**Forbidden:** direct SQL, PostgreSQL-specific types, framework runtime details, adapter implementation code.

**Examples:** `TypeAdminApplicationService`, `NodeApplicationService`, `EntityApplicationService`, `SchemaRegistry` (port), `TypeDefinitionReader` (port), `TypeDefinitionAdminRepository` (port), `TransactionPort`, `IdGeneratorPort`, `SchemaInvalidationPort`.

### Infrastructure

**Purpose:** implement application ports using concrete technologies such as PostgreSQL, cache registries, DDL execution, external messaging, or concrete schema compilation.[cite:30][cite:31]

**May depend on:** Application contracts and domain types where needed.

**Allowed:** PostgreSQL adapters, DDL adapters, cache implementations, registry implementations, bridge adapters, external service connectors.

**Forbidden:** being the place where business policy is decided, being called directly by presentation, silently redefining application rules.

**Examples:** `TypeDefinitionReaderPostgres`, `TypeDefinitionAdminRepositoryPostgres`, `CachingSchemaRegistry`, `FieldSchemaCompiler`, `EntitySchemaRegistryBridge`, `SchemaInvalidationAdapter`.

### Presentation / Frontend

**Purpose:** render UI, collect input, drive user flows, and maintain a normalized read model and cache derived from backend contracts rather than from direct persistence knowledge.[cite:37][cite:9][cite:7]

**May depend on:** exposed application/API contracts only.

**Allowed:** components, view configuration, state stores, page-based cache, routing, view composition.

**Forbidden:** direct DB access, assuming fixed tree/list/detail behavior, embedding persistence rules, bypassing backend source of truth.

**Examples:** frontend read model store, page cache, configurable widgets, tree/list/detail views configured from system rules rather than hardcoded layout assumptions.

## Dependency rules

1. Domain knows nothing about application, infrastructure, or presentation.[cite:100][cite:30]
2. Application may coordinate domain and ports, but must not import concrete PostgreSQL or framework adapters.[cite:13][cite:30]
3. Infrastructure may implement ports, but must not become the source of business decisions.[cite:30]
4. Presentation must talk to backend/application contracts, never to the database or infrastructure internals.[cite:37][cite:9]
5. Post-commit side effects such as schema invalidation happen only after a successful transaction commit, never inside the DB transaction body.[cite:13]
6. Single-user and multi-user are profiles of the same application, not separate architectures.[cite:11]

## Placement matrix

| Component | Layer | Depends on | Forbidden |
|---|---|---|---|
| `NodeApplicationService` | Application | Domain, Ports | SQL direct, `pg`, UI logic |
| `EntityApplicationService` | Application | Domain, Ports, schema ports | SQL direct, concrete compiler |
| `TypeAdminApplicationService` | Application | Domain, Ports, commands | `pg`, DDL SQL generation, adapter code |
| `SchemaRegistry` | Application port | — | concrete caching logic |
| `TypeDefinitionReader` | Application port | — | PostgreSQL implementation |
| `TypeDefinitionAdminRepository` | Application port | — | SQL bodies |
| `TransactionPort` / `IdGeneratorPort` | Application port | — | business rules |
| `CachingSchemaRegistry` | Infrastructure | Application ports, DTOs | UI access, business policy |
| `FieldSchemaCompiler` | Infrastructure (pure technical component) | DTOs | DB access |
| `TypeDefinitionReaderPostgres` | Infrastructure | `pg`, application port contract | presentation calls |
| `TypeDefinitionAdminRepositoryPostgres` | Infrastructure | `pg`, application port contract | direct UI use |
| `SchemaInvalidationAdapter` | Infrastructure | `SchemaRegistry` | running invalidation before commit |
| `EntitySchemaRegistryBridge` | Infrastructure | `SchemaRegistry` | new business logic |
| `StorageTableManagementPort` | Application port | — | becoming a generic migration framework |
| `StorageTableManagementPostgres` / `StorageTableManagementSqlite` | Infrastructure | DDL port, metadata, identifier validation | arbitrary identifier interpolation |
| `ResourceRelationshipService` | Application | resource/type/ACL ports and transaction | SQL, UI state, adapter-specific logic |
| `ResourceRelationshipRepositoryPostgres` / `ResourceRelationshipRepositorySqlite` | Infrastructure | relationship persistence port | authorization or cardinality policy |
| Frontend read model | Presentation | backend/API contracts | DB access, fixed layout assumptions |
| Audit/revision adapters | Infrastructure | application ports | deciding policy relevance |

## Cross-cutting implementation rules

### Transactions and side effects

Critical mutations must follow the same sequence: structural input validation, transaction start, persistence/update work, commit, then post-commit side effects such as schema invalidation or event propagation.[cite:32][cite:13]

### Dynamic schema resolution

Dynamic schemas have one implementation path for both `node` and `entity`:
`TypeDefinitionReader` loads the active, non-tombstoned definition,
`FieldSchemaCompiler` produces the Zod schema, and `CachingSchemaRegistry`
caches it by `domain:typeKey`. `EntitySchemaRegistryBridge` adapts that unified
registry to the entity service's narrower port. Type-admin mutations invalidate
the same registry after commit through `SchemaInvalidationAdapter`; no
database-specific entity schema compiler or independent cache is retained.

Regex constraints are validated when they are written: they must be valid
JavaScript regular expressions, contain at most 512 characters, and pass the
`safe-regex2` static analysis. This protects the runtime Zod validators from
known catastrophic-backtracking patterns; a rejected expression is never
persisted by either database adapter.

### Adapter contracts

SQLite and PostgreSQL implement the same application ports. Shared contract
tests exercise observable behaviour with a real SQLite database and the
dedicated PostgreSQL integration database. Besides runtime schema and ACL
semantics, the parity suite covers node/entity round trips, ordering,
optimistic concurrency, subtree delete/restore, path reuse, transactions,
locks, attachment quota and upload rate limiting. A browser E2E starts both
persistence profiles with isolated data and compares navigation, mutations,
detail views and audit outcomes across the full admin panel. Adapter-specific
tests supplement these contracts for database-native details.

### Identity, scope and delegated permissions

User identities and `user_roles` are global in the current data model. Global
role changes and superadmin privileges are therefore superadmin-only. A local
administrator creates identities through the atomic `createScopedUser` flow:
the new identity has no global administrative role and receives one or more
initial `allow` assignments in the same transaction and audit record.

The local management boundary is computed in PostgreSQL, never in memory. It
contains only active `scope.assign` grants with `subtree` propagation whose
whole subtree remains allowed after the actor's denies. A local administrator
can read or mutate only a non-superadmin identity with at least one allow scope
and with every allow scope inside that boundary; unscoped identities and users
with global roles are intentionally invisible. `self` never authorizes a
subtree. A deny excludes an overlapping area. Scope list/detail/update/delete
use the same boundary query, while role and permission catalogues remain
superadmin-only. These rules prevent cross-scope metadata disclosure and
privilege escalation.

Delegated grants are **not durable after loss of delegation authority**. Every
scope mutation and role-permission change reconciles assignments carrying an
`assigned_by` delegator; disabling a delegator does the same. PostgreSQL
performs the coverage check and iterative cascade, removing grants until no
invalid descendant remains. Every automatic removal is written as
`security.revoke_delegated_scope` with its triggering reason. Legacy rows with
`assigned_by IS NULL` are treated as system-owned and require explicit
superadmin review rather than automatic deletion.

Administrative commands have an explicit scope class: role/permission catalog
and global user roles are global (superadmin boundary); node/entity commands
are node-bound; scope grants are coverage-bound; user list/detail/status are
management-bound. PostgreSQL RLS is not enabled for the shared application
connection because it cannot safely receive a trusted per-request actor
identity. The operational defence is a restricted application credential with
no direct table access outside the adapters; adopting RLS later requires a
transaction-local authenticated actor setting plus deny/coverage policy tests.

### Runtime schema system

Schema reconstruction is driven by relational type definitions stored in dedicated tables, not by a single JSON blob, because the design prioritizes performance, integrity, explicit governance, and runtime compilation from structured metadata.[cite:26][cite:63][cite:31]

### Frontend composition

The frontend must be configurable. Tree, list, detail, breadcrumb, and related components are not fixed architectural primitives; they are configurable consumers of a shared read model/cache.[cite:9][cite:7][cite:37]

Semantic views store ordered, typed references (`namespace`, `id`, required
completeness) to canonical records rather than untyped IDs or copied payloads.
View satisfaction is evaluated generically from those references. Missing or
incomplete records are hydrated through authorized backend contracts; changes
to membership or ordering invalidate dependency tokens. No view-specific
component may infer completeness from incidental records already in memory.

App Router `page.tsx` and `layout.tsx` files are composition boundaries: they
resolve route parameters and assemble a screen, but do not own state, effects,
reducers or transitions. View state and orchestration belong in dedicated
hooks/controllers; rendering belongs in screen and section components. The Web
architecture test enforces a 60-line ceiling and rejects React state/effect
hooks in route files. Dynamic node/entity forms share coercion, initialization,
attachment validation and upload helpers instead of duplicating those rules in
each route.

### Type administration and DDL

Administrative metadata management and physical storage DDL are distinct responsibilities. They may be orchestrated together by the application layer, but repository write-side logic and DDL generation must remain separated by ports.[cite:26][cite:13]

## Rule for new components

Before implementing any new component, the following must be written down first:

1. Bounded context.
2. Technical layer.
3. Allowed dependencies.
4. Forbidden dependencies.
5. Whether it runs inside transaction, after commit, or both.
6. Which existing port it implements or which new port it requires.

If these six points are not clear, the component is not ready to be implemented. This rule exists specifically to avoid infinite design loops caused by placing responsibilities only after code has already started to take shape.[cite:13][cite:101]

## Practical usage

`ARCHITECTURE.md` is the canonical placement document for the repository. It should be updated only when a truly new architectural responsibility is introduced, not when an internal implementation detail changes.[cite:13]
