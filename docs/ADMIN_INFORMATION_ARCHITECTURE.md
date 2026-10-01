# Administrative information architecture

## Purpose

This document defines the canonical navigation structure of the Nodriva
administration workspace. It is a Web presentation contract: it changes neither
backend authorization nor the technical ownership of a persisted setting.
Application and Domain remain authoritative for every permission and validation.

## Canonical modules

The administration workspace is organized by the intent of the administrator:

| Area | Modules | Canonical route family |
| --- | --- | --- |
| Model | Types, placement policies, field protection | `/admin/model/*` |
| Content | Nodes, entities, attachment protection | `/admin/content/*` |
| Access | Users, roles, scopes | `/admin/access/*` |
| Automation | Workflows | `/admin/automation/*` |
| Governance | Audit log, audit settings, recycle bin | `/admin/governance/*` |
| Settings | Runtime and integrations, session security, other settings | `/admin/platform/*` |

The registry in `packages/web/src/adminPanel/AdminModuleRegistry.ts` is the
single executable definition of this tree. Sidebar navigation, overview links,
module state and collection resources use its module keys and routes; a screen
must not independently invent a second hierarchy.

Every navigable module declares one icon from the shared `AdminIcon` vocabulary.
The icon communicates the module's purpose in the rail and section header; the
localized label remains authoritative and must always be rendered alongside it
when space permits. A missing or unknown icon is a registry error, not a reason
to fall back silently to the generic dashboard symbol.

The Admin visual accent is configured once in `packages/web/src/app/globals.css`
through the `--admin-accent-*` tokens on `.admin-page`. Navigation, buttons,
focus rings, pagination, toolbars and dashboard cards must consume this shared
accent contract; a component must not introduce a separate purple/blue palette.

## Administrative resource details

The `Content → Nodes` and `Content → Entities` collections open child details
at `/admin/content/nodes/:nodeId` and
`/admin/content/entities/:parentNodeId/:entityId`. These routes are surfaces for
administrative inspection and action, not independent sidebar modules: they
keep context, return navigation and actions inside `Admin → Content`.

The administrative detail uses the same authorized read, lock/draft controller
and application commands as the operational node or entity workspace. Admin
does not introduce a second ACL, lock, `rowVersion`, deletion, attachment or
audit policy. `NodeApplicationService`, `EntityApplicationService` and their
transaction boundaries remain the owners; the Admin controller only owns
composition, navigation and presentation state.

An administrator sees a resource only when the normal node-bound or
entity-bound read authorizes it in the administrator's scope. The route does
not turn `system.config.read`, the Admin role or list membership into an extra
permission. A denial has the same forbidden semantics as the operational
surface and does not reveal data or existence outside scope.

The screen shows identity, type, path or container, `rowVersion`, lock state,
dynamic fields, relationships and attachments. Mutations first acquire the
lock and preserve the draft, version conflict and realtime invalidation through
the shared lifecycle. A successful deletion returns to the relevant Admin
collection instead of redirecting to the operational workspace.

Admin collections expose an `Open administrative detail` action; a link to the
operational workspace remains secondary and explicit. Test nodes and entities
for row-to-route mapping, in-scope reads, out-of-scope denial, lock and
`rowVersion` edits, return after deletion, realtime invalidation and
SQLite/PostgreSQL parity.

Administrative refresh actions always use `AdminRefreshButton`. The component
centralizes icon, label, callback, accessibility and sizing: it renders the
localized label with the icon and keeps a compact width in toolbars. Screens
must not recreate a local refresh-button variant.

Dates and technical identifiers use the shared formatters in
`packages/web/src/adminPanel/adminFormatters.ts`. Persisted ISO dates use the
active locale and four-digit years; long identifiers are abbreviated only
visually while the data contract keeps the full value copyable from audit
details. A tooltip is only a desktop aid. When a record has `resourceLabel`, an
UUID is not its only human description: the label precedes it, with an explicit
technical fallback for historical audits and unlabeled resources. The
composition root applies `DescriptiveAuditPort`; Web components do not map each
resource type independently.

## Settings ownership and optional capabilities

System settings are technically generic, but each known setting is displayed
where its operational purpose belongs:

| Setting key | Administrative module |
| --- | --- |
| `data.fieldsEncryptionEnabled` | Model → Field protection |
| `attachments.antivirusEnabled`, `attachments.encryptionEnabled` | Content → Attachment protection |
| `audit.recordLockLifecycle` | Governance → Audit recording |
| `session.idleTimeoutSeconds` | Platform → Session security |

`Settings → Other settings` is an explicit fallback for settings introduced by
a deployment or a later version before they receive a semantic owner. It shows
only unclassified keys, so it is not a second generic settings area. A missing,
disabled or unsupported optional capability must render as its normal runtime
state (or an authorized empty state), never as a client error. The capability
catalogue remains under Platform → Runtime and integrations.

`Platform → Integrations` (`/admin/platform/integrations`) groups realtime,
attachment scanning, account delivery and observability. It shows the sanitized
provider, availability, fallback, dependencies and lifecycle and may request a
non-mutating healthcheck. Deployment topology, endpoints, ports, secret
references and secret values are neither rendered nor editable.

`Platform → Data & recovery` (`/admin/platform/data-recovery`) groups the
database, attachment storage, backups and key material required for recovery.
It exposes only sanitized evidence for the last verified backup: provider,
date, checksum, size, schema version, restore verification and recovery
dependencies. The manifest is optional; if deployment cannot read it, the view
shows `unavailable` without disabling Admin. It neither starts backups nor
performs restores.

`Platform → Health & observability` (`/admin/platform/health`) presents the full
catalog for the health intent. `disabled` is an intentional state distinct from
`unavailable`; refresh invokes only authorized non-mutating probes.

`Platform → Backup` owns the `backup.scheduledEnabled` runtime policy. It only
pauses the deployment job's automatic execution, with audit and explicit state;
it does not control containers, operating-system schedulers or operational restore.

## Controlled route break

The previous flat and technical paths (`/admin/types`, `/admin/users`,
`/admin/security/*`, `/admin/system/*`, `/admin/audit`, and
`/admin/recycle-bin`) are retired. They have no redirects, aliases or workspace
state migration. An attempt to open one renders the explicit unavailable-module
screen and requires navigation to a canonical route.

This is intentionally a controlled breaking change: it prevents bookmarks and
new code from perpetuating an obsolete structure. Tests must assert both the
canonical route and the absence of the retired route from the module registry.

## Implementation rule for new modules

Before adding a module, define in the registry its semantic area, canonical
route, localized label and description, required backend permission(s), and any
feature/capability condition. If it exposes a new setting, assign that key to
one semantic owner; until then it is visible only in the explicit Platform
fallback. The module must use shared Admin resource, collection, form and
workspace-state contracts, including the documented realtime dependencies.

The Web change must include localized English and Italian labels, authorization
coverage, an empty/unavailable state for disabled optional capability, and an
admin E2E update when the route is user-visible.
