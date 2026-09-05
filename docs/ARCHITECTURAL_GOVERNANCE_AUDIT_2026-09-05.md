# Verifica governance architetturale 2026-09-05

Fonte storica: `/home/marco/NODRIVA_AUDIT_TECNICO.md`.
Fonte operativa stato: `docs/NODRIVA_AUDIT_REMEDIATION_TRACKER.md`.

Questa verifica non riscrive l'audit storico. Serve a fissare dove i vincoli
architetturali risultano rispettati, dove sono ancora violati e quali guardrail
devono accompagnare le correzioni.

## Esito sintetico

La separazione base Domain/Application/Infrastructure e' presente e il test
`packages/core/src/application/ArchitectureLayerCompliance.test.ts` blocca le
dipendenze dirette da Infrastructure dentro Domain/Application.

Il problema residuo non e' la direzione degli import. Il problema e' che alcune
policy trasversali non hanno ancora un solo owner applicativo e un contratto di
port completo. Questo permette a repository o servizi diversi di applicare la
stessa regola con parametri incompleti o con semantiche diverse.

## Violazioni confermate

### F-01 - Cifratura SQLite non collegata al contratto applicativo

Stato corrente: risolto dopo questa verifica.

Evidenza:

- `packages/web/src/server/db.ts` costruisce `FieldEncryptionServiceSqlite`, ma
  i repository SQLite arrivano da `SqliteInfrastructure`.
- `packages/core/src/infrastructure/sqlite/NodeRepositorySqlite.ts` e
  `EntityRepositorySqlite.ts` serializzano direttamente `payload` con
  `JSON.stringify`.

Violazione governance:

- la policy di cifratura esiste come infrastruttura, ma non e' resa obbligatoria
  dal contratto applicativo comune;
- PostgreSQL riceve il servizio di cifratura nei repository, SQLite no;
- manca un test di storage grezzo che fallisca quando un campo marcato
  `encrypted` resta in chiaro.

Guardrail applicato:

- repository PostgreSQL e SQLite collegati allo stesso contratto
  `FieldEncryptionService`;
- SQLite protegge create/update, ripristina find/list/read-model con payload e
  redige revisioni;
- contract/parity con verifica raw storage, round-trip, revisioni e rotazione.

### F-04 - `rowVersion` del move non atomica

Stato corrente: risolto dopo questa verifica.

Evidenza:

- `NodeApplicationService.moveNode` confronta `expectedNodeRowVersion` dopo una
  `findById`;
- `NodeRepository.moveSubtree` non riceve la versione attesa;
- gli adapter aggiornano il sottoalbero senza condizionare la write alla
  versione originale della radice.

Violazione governance:

- la concurrency policy viene controllata nel servizio, ma la write decisiva non
  e' condizionata dalla stessa informazione;
- il port e' incompleto, quindi gli adapter non possono garantire atomicita'.

Guardrail applicato:

- `moveSubtree` deve ricevere `expectedRowVersion`;
- la radice deve essere aggiornata con `WHERE id = ... AND row_version = ...`
  nella stessa operazione atomica;
- test PostgreSQL e SQLite verificano mismatch e stato invariato.

### F-05 - Ownership lock di sottoalbero incompleta

Stato corrente: risolto dopo questa verifica.

Evidenza:

- `LockService.requireOwnedLock` usa correttamente `(userId, sessionId)`;
- `NodeRepository.assertSubtreeUnlocked` riceve solo `actorUserId`;
- PostgreSQL filtra i conflitti con `l.user_id::text <> $2`;
- SQLite filtra i conflitti con `lock.user_id<>?`.

Violazione governance:

- la lock ownership e' definita correttamente nel servizio, ma il controllo di
  sottoalbero usa una policy diversa;
- il port non trasporta `sessionId`, quindi non puo' distinguere due sessioni
  dello stesso utente.

Guardrail applicato:

- il controllo di sottoalbero riceve sempre `(actorUserId, actorSessionId)`;
- tutti i call site devono usare lo stesso contratto;
- test con due sessioni dello stesso utente: la sessione non proprietaria deve
  essere bloccata.

### F-06 - Nome permesso interpretato come chiave tecnica

Stato corrente: risolto dopo questa verifica.

Evidenza:

- `AccessControlPortPostgres` contiene condizioni
  `(p.permission_key = $2 OR p.name = $2)`;
- `AccessControlPortSqlite` risolve `permissions` con
  `permission_key=? OR name=?`.

Violazione governance:

- la policy di autorizzazione accetta due identificatori con significato diverso;
- un nome descrittivo puo' collidere con una chiave tecnica;
- il backend non mantiene separati catalogo umano e contratto tecnico.

Guardrail applicato:

- i controlli autorizzativi devono usare solo `permission_key`;
- eventuali label restano read model/UI;
- test negativo collisione `name == other.permission_key`, PostgreSQL e SQLite;
- guardrail statico in `ArchitectureLayerCompliance.test.ts` contro fallback
  `permission_key OR name`.

### F-07 - Recovery account non ancora verificata come transazione atomica

Evidenza audit:

- token di recovery persistito prima della consegna esterna e dell'audit.

Violazione governance:

- dato, audit e outbox/consegna non sono dimostrati come una sola intenzione
  applicativa idempotente;
- il rischio e' avere un token valido senza evidenza operativa completa.

Guardrail richiesto per chiudere:

- token, audit e outbox nello stesso confine transazionale quando possibile;
- consegna esterna post-commit idempotente;
- test di fallimento consegna e retry.

## Punti gia' ricondotti dentro governance

### F-02 - Relationship visibility

Stato tracker: risolto.

La regola ora e' esplicita: la lettura/idratata delle relazioni deve filtrare
target non visibili e target soft-deleted. La lista dettagliata dei referencer
F-03 resta separata perche' richiede un read model batch per label visibili, ma
non riapre F-02.

### F-03 - Deletion policy

Stato tracker: risolto.

Il flusso ha un owner applicativo, usa transazione condivisa, restrict,
sospensione con provenance, restore batch-aware, lock deterministici e test
runtime PostgreSQL dedicati.

## Guardrail mancanti

I test di architettura attuali verificano soprattutto dipendenze di layer e
alcuni contratti frontend/cache. Non impediscono ancora:

- port incompleti per policy trasversali;
- duplicazione di una stessa policy fra servizio e repository;
- uso di identificatori descrittivi al posto di chiavi tecniche;
- controllo `rowVersion` fuori dalla write atomica;
- differenze non intenzionali tra adapter.

Questi guardrail vanno aggiunti insieme alla chiusura dei singoli rilievi, non
come regole testuali generiche difficili da rendere affidabili.

## Ordine operativo raccomandato

1. F-07 e successivi: affrontarli dopo aver chiuso F-01,
   salvo cambio di priorita' esplicito.

## Regola pratica da applicare da ora

Ogni fix audit deve iniziare dichiarando:

- policy owner;
- port modificato;
- call site coinvolti;
- adapter coinvolti;
- test che dimostra la vecchia deviazione;
- comando di verifica PostgreSQL/SQLite.

Senza questi elementi, il fix puo' essere utile ma non chiude il rilievo.
