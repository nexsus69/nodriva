# Administrative UX and semantic catalogues

## Purpose

Administrative interfaces translate Nodriva's stable technical contracts into
clear, safe tasks. They must not require an administrator to remember or type
an internal identifier merely because that identifier is what an API persists.
This document is normative for every existing and new administration module.

It does not weaken backend contracts: authorization, validation, immutable
keys, versioning, scope and concurrency remain verified by Application and
Domain code. It defines how the Web layer exposes those contracts.

## Human values and technical values

Every configurable concept has two possible representations:

- a **human value**: localized name, concise explanation and, when useful,
  domain context such as subject kind, status or risk;
- a **technical value**: stable identifier sent through the typed application
  contract and stored by the backend.

The UI uses the human value as its primary representation. The technical value
is visible when it assists administration, troubleshooting or copying, but is
secondary and never the only label. A missing historical catalogue entry must
remain visible using an explicit unavailable/legacy fallback containing its
technical value; it must not silently become a different choice.

## Catalogue rule

When the possible values are finite and can be known by the application, the
server exposes an authorized catalogue and the Web UI consumes it through its
cache/coordinator. The control is a searchable select, command picker or
checklist appropriate to cardinality. Each option has at least a label and
technical value; it also has a description whenever choices are not
self-explanatory.

Examples include audit action keys, resource kinds, workflow events, workflow
actions, roles, permissions, types, lifecycle states and assignment effects.
An audit filter therefore presents “Aggiornamento entità” and sends
`entity.update`; it does not ask the user to type the latter.

Free text is permitted only for genuinely open values, such as a resource ID,
full-text search, a user-authored name or a documented advanced expression.
It is not a shortcut for omitting a finite catalogue. If a catalogue is too
large, it may be server-searchable and paged, but remains semantic.

## Keys and names

Technical keys are stable identifiers, not titles. Forms that create a
configuration object must:

1. collect a human-readable name and optional description first;
2. propose a normalized technical key from the name whenever a key is needed;
3. explain the accepted grammar and validate it immediately in the client;
4. enforce the same rule in the backend;
5. allow an authorized user to override the proposal only in an explicit
   advanced section;
6. retain the exact key after publication when the object is immutable.

No automatic normalization may unexpectedly rename an existing published
object. Legacy keys remain readable and executable unless an explicit,
versioned migration says otherwise.

## Configuration flows

Complex configuration follows progressive disclosure:

1. identify the object and its purpose;
2. select the triggering event or context from a semantic catalogue;
3. select and configure one or more supported actions;
4. add optional conditions, error handling and advanced parameters;
5. review, validate, test where supported, then publish or activate.

The interface must show a compact summary of the current configuration and
retain drafts, chosen filters, selected resource and wizard step through the
administrative workspace state contract. Published immutable versions are
clearly distinguished from editable drafts. A graph/canvas is appropriate only
when branching, joins or dependencies make a sequential representation
ambiguous; it must complement, not replace, accessible forms and summaries.

## Safety and access

Catalogues are read models, not authorization grants. They are scoped to the
current actor where visibility matters, and every submitted technical value is
validated again by the backend. The UI distinguishes an empty authorized
catalogue from loading and from an unavailable service. It must not turn a
catalogue retrieval failure into an empty selection or a free-text bypass.

## Delivery and tests

Each conversion of an existing technical-input screen is delivered as a
vertical change:

- define or reuse the typed catalogue contract at the correct application
  boundary;
- expose it through the existing cache and Server Action conventions;
- render labels, descriptions, search and explicit legacy fallback;
- persist filter/draft/workspace state using `useAdminModuleState` where
  applicable;
- test label-to-value mapping, empty/loading/unavailable states, stale or
  legacy selected values, authorization and submitted backend validation;
- extend admin E2E when the change is user-visible.

Conversions are prioritized by frequency, risk and current user confusion.
They are intentionally incremental: do not replace every administrative form
in a single refactor.

## Current implementation status

The audit module is the first completed conversion. Its action and resource
kind filters load a permission-checked, adapter-parity catalogue of observed
values, render localized semantic labels through the shared searchable select,
and submit the original technical values. The audit list and detail use the
same labels while retaining the exact identifier as secondary support context.

Workflow configuration uses the same selector primitive for event and action
catalogues. It collects a human name first, proposes a `snake_case` key, keeps
technical-key customization explicit, and preserves the form draft in the
admin workspace. Role creation follows the same name-first and generated-key
pattern. Other modules remain scheduled incremental conversions, rather than
being silently treated as compliant.
