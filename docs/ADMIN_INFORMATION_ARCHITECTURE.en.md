# Administrative information architecture

[English](ADMIN_INFORMATION_ARCHITECTURE.en.md) | [Italiano](ADMIN_INFORMATION_ARCHITECTURE.md)

This document defines the canonical navigation of the Nodriva administration
workspace. It is a presentation contract: Domain and Application remain owners
of authorization and validation.

| Area | Modules | Route family |
| --- | --- | --- |
| Model | Types, placement policies, field protection | `/admin/model/*` |
| Content | Nodes, entities, attachment protection | `/admin/content/*` |
| Access | Users, roles, scopes | `/admin/access/*` |
| Automation | Workflows | `/admin/automation/*` |
| Governance | Audit, audit settings, recycle bin | `/admin/governance/*` |
| Settings | Runtime, integrations and session security | `/admin/platform/*` |

`AdminModuleRegistry` is the single executable definition. Screens do not invent
parallel hierarchies or authorization checks. Detail pages reuse the normal
node/entity read, lock, draft, attachment, deletion and audit contracts; an
administrative route does not reveal a resource outside the actor's scope.

Known settings have one semantic owner. Unknown deployment settings appear only
in the explicit fallback area. Optional capabilities distinguish `disabled`
from `unavailable`; health checks are non-mutating. Data and recovery views
expose only sanitized backup evidence and never start backup or restore.

Retired technical routes have no aliases or redirects. New modules must declare
area, route, localized labels, backend permissions, capability condition and
workspace/realtime contracts, with authorization and admin E2E coverage.
