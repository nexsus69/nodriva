# Backend alignment TODO

> **Status: normative implementation checklist.** This document tracks the
> remaining work required to make delegated administration, ACL enforcement and
> operations match the architecture contract. Every completed item needs code,
> automated tests and any affected documentation updated in the same change.

## Stato architetturale: attuale e obiettivo

### Attuale

- il core usa porte e adapter; PostgreSQL e SQLite sono i due adapter di
  persistenza selezionabili;
- `docker-compose.full.yml` fornisce uno stack completo per sviluppo/staging;
- realtime, antivirus, backup, storage e osservabilità sono configurabili
  soprattutto tramite environment/Compose;
- esistono registry, resolver, repository PostgreSQL e sorgente environment
  collegata al composition root Web;
- alcuni provider applicativi leggono ancora direttamente environment e secret,
  mentre healthcheck e selezione effettiva dei provider non sono ancora gestiti
  dal registry;
- il profilo standalone SQLite è disponibile con il solo Node.js e un file
  locale; build, suite automatiche e smoke HTTP sono verificati.

### Obiettivo

L'applicazione dovrà supportare deployment standalone, distribuiti e Compose
completo senza modificare il dominio applicativo. Ogni servizio dovrà avere un
provider/adapter sostituibile e una configurazione separata per capability,
provider, endpoint, secret, timeout, retry, healthcheck e requisito di riavvio.
Il Compose completo sarà un profilo di deployment, non il requisito minimo
dell'applicazione. Per la persistenza standalone dovrà essere introdotto e
verificato un adapter SQLite o equivalente.

Il piano dettagliato è in
[`SERVICE_CONFIGURATION_ARCHITECTURE.md`](./SERVICE_CONFIGURATION_ARCHITECTURE.md)
e [`RUNTIME_CONFIGURATION_CATALOG.md`](./RUNTIME_CONFIGURATION_CATALOG.md).

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

## P1 — Runtime session policy

- [ ] Rendere il `ServiceConfigurationRegistry` l'unico punto di risoluzione
  per database, realtime, storage allegati, antivirus, mail, backup e
  osservabilità, sostituendo le letture dirette di environment/secret e
  completando timeout, retry, healthcheck, dipendenze, origine del valore e
  requisito di riavvio.
- [ ] Separare nella configurazione la capability (`enabled`), il provider,
  gli endpoint pubblici/interni e i riferimenti ai secret; non esporre secret
  al client né trattare la configurazione Compose come configurazione runtime.
- [ ] Rendere il Compose modulare e documentare profili coerenti per i servizi
  opzionali, mantenendo un profilo completo per sviluppo/staging.
- [x] Introdurre un adapter di persistenza standalone SQLite, collegarlo al
  composition root Web e verificarne build, suite e smoke test.

- [ ] Approve the complete runtime/deployment/secret configuration catalog in
  [`RUNTIME_CONFIGURATION_CATALOG.md`](./RUNTIME_CONFIGURATION_CATALOG.md)
  before adding further settings to the administrative UI.
- [ ] Replace the temporary build/deployment value
  `NEXT_PUBLIC_SESSION_IDLE_TIMEOUT_SECONDS` with an authoritative backend
  system setting for the session inactivity timeout. The current 1800-second
  value is a user-friendly default and is still not runtime-configurable.
- [ ] Expose the effective timing policy to authenticated clients through a
  backend bootstrap/configuration contract; do not require a frontend rebuild
  when an administrator changes it.
- [ ] Continue deriving heartbeat throttle, passive sync interval, lock TTL,
  expiry safety buffer and cache sweep interval from the single backend value;
  reject independent or hardcoded timer values.
- [ ] Add validation bounds, administrative authorization, audit history and
  tests for runtime changes, including the behaviour of sessions and locks
  created before a policy change.

## P2 — Scale and hardening

- [x] Optimize subtree ACL SQL by materializing/indexing the assigned node path
  or another set-based equivalent; benchmark before changing semantics.
- [x] Define audit retention, export and access-review procedures.
- [x] Add password-reset/invitation workflow, rate limits and optional MFA for
  administrative identities.
- [ ] Make MFA factor replacement atomic: keep the active factor enabled until
  the new TOTP secret is confirmed; store pending secrets separately with an
  expiry and add recovery-code regeneration/status handling.
- [x] Document and test portability boundaries outside PostgreSQL (`ltree`,
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

## P1 — Server Action error UX

- [ ] Replace the generic production message shown when a Server Action
  rejects a validation or authorization error (for example an invalid
  relation target) with a localized, actionable application message. Preserve
  the fail-safe boundary: never expose stack traces, SQL details or internal
  digests to the client, and add E2E coverage for validation, authorization
  and unexpected-error paths.
