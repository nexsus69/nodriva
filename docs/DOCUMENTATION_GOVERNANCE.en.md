# Documentation governance

[English](DOCUMENTATION_GOVERNANCE.en.md) | [Italiano](DOCUMENTATION_GOVERNANCE.md)

## Authority order

1. Source code, executable migrations and automated tests define observed
   runtime behavior.
2. `ARCHITECTURE.md` and documents in `docs/` explicitly marked normative
   define the intended architecture and operating model.
3. Historical requirements, design alternatives and product direction are
   private local archives, not executable API, schema or deployment contracts.
   The initial executable installation schema is maintained in
   `db/schema/001_baseline_schema.sql`.

When source and normative documentation diverge, treat it as a defect and
update the implementation or normative document in the same change. When a
historical requirement is superseded, retain it locally and record the decision
in the current operational document rather than silently rewriting history.

Planning notes, AI prompts, handoffs, dated audits and completed trackers are
private working material and are not part of the published documentation set.
Historical files are excluded from Git; untracking preserves local copies but
does not erase earlier Git history. Rewriting history requires explicit approval.

## Runtime contract locations

- Application ports and services: `packages/core/src/application/`
- PostgreSQL schema evolution: `db/migrations/`
- Realtime lifecycle: `docs/REALTIME_MUTATION_LIFECYCLE.md`
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
English editions. Unsuffixed paths may remain for compatibility with existing
links; an English companion uses the `.en.md` suffix, or the language index in
`docs/README.en.md`. New prose must not alternate languages inside one edition.
Technical identifiers, code blocks, route names and configuration keys are not
translated.

When a normative contract changes, update both editions in the same change and
run the documentation link check. A translation must preserve commands,
invariants, security warnings, adapter differences and operational limits; a
summary is not a substitute for the normative edition.
