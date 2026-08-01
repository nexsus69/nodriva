# Known Trade-offs

Questo documento traccia i trade-off architetturali noti, accettati durante lo sviluppo, che potrebbero richiedere ottimizzazioni future.

## Fase A: Read Access Control & LTree Subquery

**Contesto:**
Il filtraggio in lettura su PostgreSQL (Data Masking) è stato centralizzato nel costrutto SQL condiviso `AccessControlPortPostgres.getReadAccessControlSql`.

**Problema (Trade-off):**
Per verificare se un record rientra in un'assegnazione di scope di tipo `subtree`, la clausola SQL esegue ricorsivamente la subquery `(SELECT path FROM nodes WHERE id = nsa.node_id LIMIT 1)` all'interno delle condizioni `EXISTS`. 
Su elenchi paginati immensi (milioni di record) con molteplici ruoli utente, il database esegue un Nested Loop. Pur essendoci un indice Hash/BTree in Primary Key per velocizzare la subquery e l'indice GiST per l'operatore `@>`, l'esecuzione iterativa della subquery per ogni riga in esame per matchare il subtree può degradare le performance (es. fallback in Table Scan se l'optimizer PostgreSQL deduce troppa varianza).

**Perché è stato accettato:**
In Fase A (MVP), l'integrità del Single Source of Truth per l'ACL ha priorità assoluta sulle performance estreme. Centralizzare la logica senza inquinare la memoria applicativa garantisce stabilità e correttezza funzionale. L'attuale stack PostgreSQL gestisce agilmente questi carichi su alberi di medie dimensioni.

**Possibili Strategie di Ottimizzazione (Future):**
1. **Materializzazione dello Scope Path:** Aggiungere una colonna ridondante `node_path` in `node_scope_assignments`, popolandola in modo asincrono (es. trigger DB o Domain Event). In questo modo, l'operatore ltree confronterebbe direttamente `nsa.node_path @> n.path` abbattendo la subquery a zero.
2. **Pre-calcolo in Application Layer:** Risolvere gli ID dei nodi consentiti/negati (con relativi path) in memoria (in NodeApplicationService) in un'unica query preparatoria, passando al Query Port un array testuale del tipo `ANY($ALLOWED_PATHS)`.

**Metriche da monitorare:**
- Query lente (`slow_queries` PostgreSQL log)
- Tempi di risposta su navigazione in root node densi (es. `listSubtreeEntitiesAction`).

## Feature 1: Login & Sessione — Scelta dello storage sessioni

**Contesto:**
È stata progettata la Feature 1 (Login e Sessione) per Dashboard V2, la quale necessita di un boundary reale e di protezione per rotte e Query Ports. 
Le opzioni valutate erano: Sessione Stateful (Tabella `user_sessions` su DB + token opaco nel cookie) vs JWT Stateless (Firma in cookie HTTP-only).

**Opzione Selezionata: Sessione Stateful (Tabella `user_sessions`)**

**Motivazione e Trade-off (Accettato):**
Sebbene il JWT eviti teoricamente l'interrogazione del database a ogni Server Action, si è scelto consapevolmente l'approccio **Stateful**. 
Nel contesto specifico di Dashboard V2:
- La singola query SQL per chiave primaria necessaria a validare il token (`SELECT user_id FROM user_sessions WHERE session_token_hash = $1`) costa tipicamente <1ms, risultando totalmente trascurabile rispetto all'onere delle macro-query LTree di Read Access Control che l'architettura già esegue di default a ogni richiesta.
- JWT non consente una vera revoca immediata server-side prima della scadenza naturale senza ricorrere a denylist (rendendo di fatto il sistema stateful ma più complesso).

**Implicazioni Future Protette dalla Scelta:**
- **Logout Reale & Sicurezza:** Una sessione può essere fisicamente distrutta dal DB, bloccando all'istante l'utente (es. disabilitazione forzata da Admin).
- **Lock/Unlock Concorrenza:** I lock sulle entità possono essere intrinsecamente legati al ciclo di vita della sessione esatta; se la sessione cade, il lock decade, garantendo zero deadlock invisibili.
### Trade-off RISOLTO: Storage Session Token in chiaro

**Contesto (Ex Problema):**
Nella Fase 1, il token di sessione (generato crittograficamente in modo randomico) veniva salvato in chiaro nella colonna `sessions.token` del database. In caso di un eventuale dump illecito del database, l'attaccante avrebbe potuto ottenere l'elenco dei token attivi ed eseguire un *session hijacking* diretto. Il modello canonico attuale è `user_sessions.session_token_hash`.

**Risoluzione (Fase 2 - Auth Hardening):**
Il trade-off è stato **RISOLTO**. 
Ora, l'architettura separa le due identità del token:
1. Il token opaco originale viene inviato in chiaro ESCLUSIVAMENTE al cookie HTTP-only del browser.
2. Il server (via `AuthApplicationService`) esegue l'hash crittografico (SHA-256) del token *prima* di salvarlo su DB.
3. Al momento della risoluzione della sessione (o del logout), il token estratto dal cookie viene hashato e confrontato con il record su database.

**Impatto:**
In questo modo, un dump del DB espone unicamente hash irreversibili, annullando totalmente il rischio di hijacking post-breach. Nessuna modifica è stata necessaria all'interfaccia dell'adapter (DIP preservato), poiché la crittografia è gestita all'interno dell'Application Service come business policy.

### Copertura Auth / Intercettazione 401 (Stato Attuale)

**Contesto:**
Il layer client (`AppCache`) intercetta gli errori 401 provenienti sia dalle aggregazioni (liste e metadati via `FetchCoordinator`) sia dalle singole mutazioni o fetch di dettaglio (`GlobalCacheClient`).

**Stato di adozione (MVP):**
La copertura 401 viene considerata **sufficiente e solida per l'MVP**. Eventuali chiamate HTTP invocate al di fuori del perimetro del Semantic Cache Engine non beneficeranno automaticamente di questo trigger di purge (risultando come un punto grigio architetturale "fuori contratto"), ma fintantoché lo sviluppo UI rispetta la regola aurea di passare esclusivamente per le primitive di `AppCache`, il flusso garantisce il drop immediato di RAM e la messa in sicurezza su tutti i device client.
