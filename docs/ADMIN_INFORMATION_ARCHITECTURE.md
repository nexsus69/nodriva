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
| Governance | Audit log, audit recording, recycle bin | `/admin/governance/*` |
| Platform | Runtime and integrations, session security, other settings | `/admin/platform/*` |

The registry in `packages/web/src/adminPanel/AdminModuleRegistry.ts` is the
single executable definition of this tree. Sidebar navigation, overview links,
module state and collection resources use its module keys and routes; a screen
must not independently invent a second hierarchy.

Every navigable module declares one icon from the shared `AdminIcon` vocabulary.
The icon communicates the module's purpose in the rail and section header; the
localized label remains authoritative and must always be rendered alongside it
when space permits. A missing or unknown icon is a registry error, not a reason
to fall back silently to the generic dashboard symbol.

## Settings ownership and optional capabilities

System settings are technically generic, but each known setting is displayed
where its operational purpose belongs:

| Setting key | Administrative module |
| --- | --- |
| `data.fieldsEncryptionEnabled` | Model → Field protection |
| `attachments.antivirusEnabled`, `attachments.encryptionEnabled` | Content → Attachment protection |
| `audit.recordLockLifecycle` | Governance → Audit recording |
| `session.idleTimeoutSeconds` | Platform → Session security |

`Platform → Other settings` is an explicit fallback for settings introduced by
a deployment or a later version before they receive a semantic owner. It shows
only unclassified keys, so it is not a second generic settings area. A missing,
disabled or unsupported optional capability must render as its normal runtime
state (or an authorized empty state), never as a client error. The capability
catalogue remains under Platform → Runtime and integrations.

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
