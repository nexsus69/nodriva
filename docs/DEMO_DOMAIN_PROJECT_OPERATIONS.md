# Nodriva: canonical project-operations vertical

Nodriva is the product name. The project-operations scenario is its canonical
vertical for acceptance and regression: it demonstrates the generic platform
without turning nodes, types, entities or relationships into domain-specific
primitives. Package names, database identifiers and historical documents keep
their existing names until an explicit technical migration is approved.

The demo seed keeps the original orders fixture for compatibility and adds the
representative Nodriva scenario:

```text
Acme Delivery Organization
└── Platform Division
    └── Core Team
        ├── Control Center Project
        │   └── Foundation Milestone
        └── Experience Project
            └── Mobile Milestone
```

The dynamic entity types are:

- `project-brief`: status, owner, client and dates;
- `task-record`: status, priority, assignee, due date and a task dependency;
- `project-document`: document type, version and review status.

The `task-record.depends_on` field is a relation targeting another
`task-record`, so the fixture exercises relation metadata in addition to
hierarchy and dynamic storage tables.

The scenario is retained in installations that already loaded the historical
demo fixture. New installations use the non-destructive administrative
bootstrap; demo data must be provisioned explicitly by development or E2E
fixtures and is never created during service startup. Historical instructions
referring to `RESET DEMO DATABASE` and `ALLOW_DESTRUCTIVE_SEED` are obsolete:
the current application does not expose that reset flow. `INITIALIZE SYSTEM`
is an authenticated administrative bootstrap, not a demo-data loader or reset.
For an empty installation follow [the first-run guide](FIRST_RUN.md); for
automated scenarios use only the isolated test fixtures described below.

The release-gate browser scenario is `pnpm e2e:canonical`. It provisions its
own project-operations-shaped schema and data in temporary SQLite and
PostgreSQL profiles, then compares the common observable outcome. It does not
depend on the historical demo fixture and does not touch an operational
database.

The acceptance criteria and the evidence required for each step are maintained
in [`NODRIVA_ACCEPTANCE_CHECKLIST.md`](./NODRIVA_ACCEPTANCE_CHECKLIST.md).
