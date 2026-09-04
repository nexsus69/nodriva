# Tracker remediation audit Nodriva

Fonte storica: `NODRIVA_AUDIT_TECNICO.md`. Questo file e' la fonte operativa
dello stato; l'audit storico non viene riscritto.

| ID | Stato | Owner richiesto | Criterio di chiusura |
| --- | --- | --- | --- |
| F-01 | Aperto | Application encryption contract | Storage SQLite cifrato; round-trip, revisioni, rotazione e parity verdi. |
| F-02 | Risolto | Relationship read model | ACL target e idratazione parity coperti. |
| F-03 | Risolto | Resource deletion policy | Restrict, provenance, restore, TOCTOU e lock runtime coperti. |
| F-04 | Aperto | Node move use case | `expectedRowVersion` nel write atomico e test concorrente parity. |
| F-05 | Aperto | Lock ownership policy | `LockOwner(userId, sessionId)` unico in subtree/bulk/delete/move. |
| F-06 | Aperto | Access-control policy | Solo `permission_key`, collisione nome/chiave e parity. |
| F-07 | Aperto | Account recovery transaction | Token, audit e outbox atomici con retry/idempotenza. |
| F-08 | Aperto | SQLite query port | Paginazione ACL batch e benchmark. |
| F-09 | Aperto | Collection read model | Tipi/edge batch e query-count test. |
| F-10 | Aperto | Attachment envelope | Formato non ambiguo e compatibilita' legacy. |
| F-11 | Aperto | Database bootstrap | Baseline in `db/`, schema vuoto e upgrade verificati. |
