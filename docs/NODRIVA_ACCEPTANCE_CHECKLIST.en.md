# Nodriva acceptance checklist

[English](NODRIVA_ACCEPTANCE_CHECKLIST.en.md) | [Italiano](NODRIVA_ACCEPTANCE_CHECKLIST.md)

The canonical acceptance path must prove: superadmin login; type, field, enum
and relationship configuration; operator creation with role and scope; scoped
navigation and denial outside scope; node, project, task and document creation;
dynamic edits and attachments; session continuity; two-session lock and
`rowVersion` conflict; realtime on the complete profile; deletion, trash,
restore and audit; and verified database/attachment/key recovery.

SQLite covers the same common path with realtime and antivirus excluded when
unconfigured. Evidence must include backend authorization, rollback, audit,
adapter parity, browser behavior and isolated backup restore. E2E fixtures and
PostgreSQL tests use disposable resources whose database name contains `test`.
