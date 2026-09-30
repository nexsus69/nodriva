# Documentation governance

[English](DOCUMENTATION_GOVERNANCE.en.md) | [Italiano](DOCUMENTATION_GOVERNANCE.md)

## Authority order

1. Source code, executable migrations and automated tests define observed
   runtime behavior.
2. `ARCHITECTURE.md` and documents in `docs/` explicitly marked as normative
   define the intended architecture and operating model.
3. Historical requirements, design alternatives and product direction are
   private local archives, not executable API, schema or deployment contracts.
   They are excluded from Git and are not required to install the project.
   `Specifiche/dashboard_v4_schema_corrected.sql` is an explicit exception:
   despite its directory name, it is the executable installation schema and
   remains versioned until a separately coordinated relocation.

Planning notes, AI prompts, handoffs, dated audits and completed trackers are
private working material and are not part of the public documentation set.
`.gitignore` excludes historical files in `Specifiche/` except the executable
SQL above, the historical `docs/adr/` directory and dated
`docs/AUDIT_REMEDIATION_*.md` reports. Untracking these files preserves local
copies; it does not erase them from earlier commits. Rewriting repository
history requires a separate, explicit operation.

When source and normative documentation diverge, treat it as a defect: update
the implementation or the normative document in the same change. When a
historical requirement is intentionally superseded, retain it and record the
decision in the relevant operational document rather than silently rewriting
history.

## Runtime contract locations

- Application ports and services: `packages/core/src/application/`
- PostgreSQL schema evolution: `db/migrations/`
- Realtime lifecycle and operations: `docs/REALTIME_MUTATION_LIFECYCLE.md`
- Database portability: `docs/ARCHITECTURAL_PORTABILITY.md`
- Frontend data flow: `docs/FRONTEND_DATA_FLOW_STANDARD.md`
- Administrative UX and semantic catalogues:
  `docs/ADMINISTRATIVE_UX_SEMANTIC_CATALOGS.md`
- Route composition guardrails: `packages/web/src/server/ArchitectureCompliance.test.ts`
- Adapter parity: `packages/core/src/infrastructure/PersistenceAdapterParityPostgres.test.ts`
  and `e2e/admin-adapter-parity.spec.ts`
- Runtime timing: `packages/web/src/config/runtimeTiming.ts` and the
  `session.idleTimeoutSeconds` system setting seed/migrations

## Language editions

Current operator and technical documents are published as paired Italian and
English editions. A file may retain an unsuffixed path for compatibility with
existing links; its paired English edition uses the `.en.md` suffix (or the
language-index path defined in `docs/README.en.md`). Do not write mixed-language
prose in a new edition. Technical identifiers, code blocks, route names and
configuration keys are not translated.

When a normative contract changes, update both editions in the same change and
run the documentation link check. A translation must preserve commands,
invariants, security warnings, adapter differences and operational limits; a
short summary is not a substitute for the normative edition.

Historical requirements, drafts, ADRs and dated analysis are private local
archives. They are excluded from Git and must not be linked from current
documentation. The executable PostgreSQL schema remains the sole versioned
exception under `Specifiche/`.
