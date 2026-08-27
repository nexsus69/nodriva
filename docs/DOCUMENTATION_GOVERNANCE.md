# Documentation governance

## Authority order

1. Source code, executable migrations and automated tests define observed
   runtime behavior.
2. `ARCHITECTURE.md` and documents in `docs/` define the normative intended
   architecture and operating model.
3. `Specifiche/` preserves historical requirements, design alternatives and
   product direction. It is not an executable API, schema or deployment
   contract.

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
