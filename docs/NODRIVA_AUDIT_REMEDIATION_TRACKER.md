# Tracker remediation audit Nodriva

Fonte storica: `NODRIVA_AUDIT_TECNICO.md`. Questo file e' la fonte operativa
dello stato; l'audit storico non viene riscritto.

Verifica governance corrente:
`docs/ARCHITECTURAL_GOVERNANCE_AUDIT_2026-09-05.md`.

| ID | Stato | Owner richiesto | Criterio di chiusura |
| --- | --- | --- | --- |
| F-01 | Risolto | Application encryption contract | Storage SQLite cifrato; round-trip repository/read-model, revisioni, rotazione e parity verdi. |
| F-02 | Risolto | Relationship read model | ACL target e idratazione parity coperti. |
| F-03 | Risolto | Resource deletion policy | Restrict, provenance, restore, TOCTOU e lock runtime coperti. |
| F-04 | Risolto | Node move use case | `expectedRowVersion` nel write atomico e test PostgreSQL/SQLite. |
| F-05 | Risolto | Lock ownership policy | Subtree lock usa `(userId, sessionId)` in PostgreSQL/SQLite. |
| F-06 | Risolto | Access-control policy | Solo `permission_key`, collisione nome/chiave e parity coperti. |
| F-07 | Aperto | Account recovery transaction | Token, audit e outbox atomici con retry/idempotenza. |
| F-08 | Aperto | SQLite query port | Paginazione ACL batch e benchmark. |
| F-09 | Aperto | Collection read model | Tipi/edge batch e query-count test. |
| F-10 | Aperto | Attachment envelope | Formato non ambiguo e compatibilita' legacy. |
| F-11 | Aperto | Database bootstrap | Baseline in `db/`, schema vuoto e upgrade verificati. |
