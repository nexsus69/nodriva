# Service and deployment configuration

Nodriva supports a standalone SQLite profile and a distributed PostgreSQL
profile. Application code must not assume Docker, PostgreSQL, realtime,
antivirus, metrics or a proxy are always present. The composition root selects
the profile and adapters; infrastructure-specific details stay in adapters and
deployment files.

The standalone profile requires Node.js and a local database file. The complete
profile adds PostgreSQL and the integrations enabled by deployment. Compose is a
reference/test stack, not a universal production requirement. Disabling an
integration must not change shared authorization, validation, locking,
rowVersion or rollback outcomes.
