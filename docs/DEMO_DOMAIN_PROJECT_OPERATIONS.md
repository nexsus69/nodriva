# Demo domain: project operations

The demo seed keeps the original orders fixture for compatibility and adds a
representative project-operations scenario:

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
fixtures and is never created during service startup. In development
it can be activated from the landing page using `RESET DEMO DATABASE` while
`ALLOW_DESTRUCTIVE_SEED=true`; it must not be run against production data.

The release-gate browser scenario is `pnpm e2e:canonical`. It provisions its
own project-operations-shaped schema and data in temporary SQLite and
PostgreSQL profiles, then compares the common observable outcome. It does not
depend on the historical demo fixture and does not touch an operational
database.
