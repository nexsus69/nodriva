# Nodriva — canonical vertical acceptance checklist

[English](NODRIVA_ACCEPTANCE_CHECKLIST.en.md) | [Italiano](NODRIVA_ACCEPTANCE_CHECKLIST.md)

Nodriva is a generic platform for connected operational data. The
*project-operations* vertical is its acceptance path: it demonstrates nodes,
types, entities, relationships, attachments, authorization and governance
without introducing primitives tied to one business system.

This checklist defines the observable result. It does not authorize new product
capabilities: a configurable workflow/event engine remains out of scope until a
concrete Nodriva use case justifies separate design, contracts and audit.

## Canonical path

| Step | User-observed result | Automated evidence | Required operational evidence |
| --- | --- | --- | --- |
| 1. Administrator access | Superadmin signs in and can administer the catalogue. | `pnpm check`, Admin E2E in `pnpm e2e:parity` | Login on target deployment. |
| 2. Modelling | Configure or verify node/entity types, fields, enums and relationships. Dynamic data respects schema. | Canonical E2E and adapter contract tests. | — |
| 3. Operator user | Create a user and assign role and scope. | Canonical E2E. | Verify target ACL when release changes roles or scopes. |
| 4. Boundary | Operator sees only its scope; direct out-of-scope access is denied. | Canonical E2E and ACL/parity tests. | — |
| 5. Operational work | Create nodes, projects, tasks and documents; edit dynamic data and attachments without silently losing the draft. | Canonical E2E, form and unsaved-change tests. | Upload/download and scanning when attachments are enabled. |
| 6. Concurrency | Two sessions exercise lock, release and stale `rowVersion` rejection. | Canonical E2E and session/lock tests. | Real browser contention on realtime deployment when enabled. |
| 7. Recycle bin and audit | Delete/restore preserves scope and audit; restored records are coherent. | Canonical E2E and PostgreSQL/SQLite contract tests. | Inspect audit for a controlled mutation. |
| 8. Profile parity | Standalone SQLite and complete PostgreSQL produce the same common outcomes. | CI **Browser parity on SQLite and PostgreSQL** (`pnpm e2e:parity`). | Realtime and antivirus may be excluded only from SQLite profile. |
| 9. Recoverability | Schema and data can be recovered without touching the operational database. | CI bootstrap/migrations. | Checksum backup and disposable-database restore; target healthcheck and rollback plan. |

## Automated gates

The candidate commit must have these green:

- `pnpm check`;
- CI **PostgreSQL integration and adapter parity**, with no skipped tests;
- CI **Browser parity on SQLite and PostgreSQL**, running
  `pnpm e2e:parity` with Chromium;
- `git diff --check` and a working tree without unintended changes.

The browser job prepares an isolated PostgreSQL database with a restricted
application role, creates temporary SQLite and uses no operational data or
credentials.

## Deployment gate

Before declaring Nodriva ready on the selected target, complete the applicable
items in [`RELEASE_CHECKLIST.md`](./RELEASE_CHECKLIST.md): backup/restore,
healthcheck, HTTPS/cookie/WebSocket, managed secrets, attachments and antivirus,
observability, alerting and rollback. CI cannot replace these checks because
they depend on real infrastructure.

## Change rule

Any change to a step in the table must update the corresponding test and this
document in the same pull request when user-visible outcome changes. Internal
SQLite/PostgreSQL differences are allowed only when they preserve the
observable outcome listed here.
