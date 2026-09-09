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
| F-07 | Risolto | Account recovery transaction | `AccountRecoveryApplicationService` ricontrolla il superadmin e legge il destinatario dentro il `TransactionPort` che persiste hash token, audit e outbox. Il token nell'outbox e' AES-GCM cifrato; il drain post-commit usa lease/backoff e la stessa chiave di idempotenza a ogni retry. I contract SQLite/PostgreSQL coprono revoca prima della transazione, rollback e retry. Il confine Web distingue token non valido, password non conforme e guasto infrastrutturale senza esporre dettagli tecnici; l'E2E di parita' conserva la bozza dopo un audit fallito e completa il retry. |
| F-08 | Risolto | SQLite query port | ACL applicata nella query paginata con `LIMIT + 1`, senza scansione progressiva del sottoalbero; ordine backward e parità diretta SQLite/PostgreSQL coperti. |
| F-09 | Risolto | Collection read model | Tipi ed edge attivi letti in batch; query-count e parity SQLite/PostgreSQL verdi. I boundary paginati e limitati del sottoalbero sono consolidati in F-08, senza modifiche parziali al contratto della cache. |
| F-10 | Risolto | Attachment envelope | Envelope plaintext/cifrato esplicito; formati legacy non supportati e rifiutati in fase di sviluppo. |
| F-11 | Risolto | Database bootstrap | Baseline in `db/`; bootstrap su schema vuoto, upgrade storico, riapplicazione idempotente e ruolo applicativo ristretto verificati in CI. |

## Attività post-risoluzione

- **REL-UX-01 — Referenze che bloccano la cancellazione (Risolto):** la UI offre
  un accesso guidato agli edge incoming attivi che causano
  `RESOURCE_DELETE_RESTRICTED`, mostrando tipo, nome e ID soltanto per i
  referenzianti visibili all'attore e mantenendo separato il conteggio totale.
  La consultazione deve usare il read-model batch delle relazioni e non
  modificare la semantica `restrict` né aggirare i controlli ACL.
