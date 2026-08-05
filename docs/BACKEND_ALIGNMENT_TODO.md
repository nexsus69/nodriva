# Backend alignment TODO

> **Status: normative implementation checklist.** This document tracks the
> remaining work required to make delegated administration, ACL enforcement and
> operations match the architecture contract. Every completed item needs code,
> automated tests and any affected documentation updated in the same change.

## P0 — Delegated administration without privilege escalation

- [x] Add an atomic `createScopedUser` use case: create identity, initial local
  role/scope assignments and audit records in one transaction.
- [x] Define the target user's management boundary. An administrator must only
  list or mutate identities whose active allow scopes are contained by the
  administrator's delegable subtree; document the behaviour for unscoped users.
- [x] Replace node-point delegation checks with coverage checks: a `self`
  permission cannot delegate `subtree`, and all target descendants must remain
  allowed after applying the delegator's deny rules.
- [x] Apply the same coverage rule to scope-assignment updates, including
  `self` → `subtree`, role changes and allow/deny transitions.
- [x] Restrict role creation and permission edits to superadmin, or implement
  equivalent permission-subset delegation before allowing non-superadmin role
  administration.
- [x] Filter user, role and scope-assignment administration reads by the
  actor's management boundary; do not expose global identity metadata to local
  administrators.
- [x] Add integration tests for cross-scope create/update/revoke attempts,
  nested descendants, explicit deny and concurrent role/scope changes.

## P1 — ACL consistency and lifecycle

- [x] Define whether delegated grants survive when the delegator loses access;
  implement the chosen cascade/review workflow and audit it.
- [x] Validate scope-assignment targets (active user, active node, active role)
  and reject duplicate or contradictory records deterministically.
- [x] Review every administrative command for an explicit global-vs-node scope
  decision and add contract tests for the decision.
- [x] Evaluate database-level defence in depth (restricted DB credentials and,
  where appropriate, PostgreSQL RLS) for future query ports that could bypass
  application ACL filters.

## P1 — Realtime operations

- [x] Provision a scheduled authenticated worker for
  `POST /api/internal/realtime/drain`; the endpoint exists, but deployment must
  guarantee execution when there are no new mutations.
- [x] Add alerts for outbox age, retry count, lease recovery and delivery
  failure; scrape metrics from every web replica.
- [x] Add end-to-end tests for policy revocation, Pusher user termination and
  eventual outbox replay.

## P2 — Scale and hardening

- [ ] Optimize subtree ACL SQL by materializing/indexing the assigned node path
  or another set-based equivalent; benchmark before changing semantics.
- [ ] Define audit retention, export and access-review procedures.
- [ ] Add password-reset/invitation workflow, rate limits and optional MFA for
  administrative identities.
- [ ] Document and test portability boundaries outside PostgreSQL (`ltree`,
  locking and dynamic SQL are currently PostgreSQL-specific).

## P1 — Global responsive UI

- [ ] Make **every rendered DOM element** responsive on every route, not only
  lists: shell/navigation, headers, breadcrumb, tree, cards, tables, toolbar,
  filters, forms, field groups, buttons, badges, long IDs/emails, dialogs,
  overlays, errors, empty/loading states and debug surfaces. No element may
  be clipped, overlap another control, become unreachable or require page-level
  horizontal scrolling at supported mobile widths.
- [ ] Replace the current mixed mobile strategy (some record cards, some
  horizontally scrollable tables) with reusable responsive primitives and
  migrate Audit, Users, Roles, Scopes, Types, system configuration, placement
  policies, node/entity detail and every remaining workspace component.
- [ ] Verify all routes and interactive states at 320 px, 375 px and 768 px
  with long emails, UUIDs, labels, action buttons, dynamic fields and
  validation errors; add visual regression coverage for shared primitives.
