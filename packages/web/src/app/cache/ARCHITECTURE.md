# Semantic Cache Engine — Architettura Normativa

Questo documento è la fonte canonica per l'architettura di cache e fetch del frontend.
Ogni nuova implementazione, refactoring o estensione deve rispettare questi vincoli.

---

## 1. Principi Fondamentali

1. **Single Source of Truth (EntityStore)**
   Ogni entità esiste una sola volta, nell'EntityStore canonico (`DomainCacheClient` partizionato per `entityTypeId`). Nessun componente, hook, context o cache parallela può detenere una copia indipendente dello stesso dato.

2. **Separazione Vista / Dato**
   - Il **ViewStore** contiene esclusivamente metadati di navigazione: array di `ViewPage`, ciascuna con descrittori opachi (`ViewItemDescriptor`), cursori bidirezionali (`prevCursor`, `nextCursor`) e flag `hasMoreForward`/`hasMoreBackward`.
   - L'**EntityStore** contiene i payload reali delle entità.
   - Nessun payload di entità transita né viene conservato nel ViewStore.

3. **Reattività Automatica**
   Qualsiasi mutazione del dato canonico (update, delete, inject) viene propagata tramite sottoscrizioni (`DomainCacheClient.subscribe`) a tutti i consumatori registrati. Le viste che mostrano quell'entità si aggiornano istantaneamente, **senza refetch dal server**.

4. **UI Agnostica dal Fetch**
   I componenti React non conoscono endpoint, server actions, URL o protocolli. Dichiarano un intento semantico (`SemanticViewKey`) e consumano i risultati tramite hook adapter. L'orchestrazione del caricamento è responsabilità esclusiva del Service Layer.

## 1.1 CacheKernel — nuova implementazione isolata

`CacheKernel` è la nuova implementazione normalizzata sviluppata prima della
sostituzione completa dell'engine attuale. È ora usata dal percorso dei metadati
dei tipi (`useSemanticMetadata`); nodi, entità e viste paginated restano ancora
sul percorso precedente durante la migrazione controllata.

Le sue regole sono:

- ogni record viene memorizzato una sola volta tramite `namespace + id`;
- una query conserva solo gli ID ordinati, il namespace dei record e le proprie
  dipendenze, mai una seconda copia dei payload;
- le mutazioni passano da `mutate()`, che applica il risultato canonico e le
  invalidazioni dichiarate solo dopo il successo del backend;
- le dipendenze sono invalidate tramite token, così tutte le query interessate
  diventano stale insieme;
- se un token o una query vengono invalidati durante un caricamento, la risposta
  in corso viene scartata e il caricamento viene ripetuto;
- le versioni obsolete dei record vengono ignorate;
- `purge()` elimina record, query e richieste pendenti per il cambio sessione o
  il logout.

La sostituzione completa dell'engine attuale è consentita solo dopo il
completamento dei test di compatibilità per viste, paginazione, realtime, ACL,
lock e lifecycle di sessione. Fino ad allora `GlobalCacheClient` e
`GlobalViewStore` restano il percorso di produzione per le risorse non ancora
migrate.

---

## 2. SemanticViewKey

### Definizione

La `SemanticViewKey` è una stringa deterministica che identifica **un'intera vista logica**, non una singola pagina o un singolo chunk.

### Regole di Derivazione

La key è derivata esclusivamente da **parametri semantici stabili** della richiesta:
- `viewType` — tipo di vista (`SUBTREE_LIST`, `ENTITY_DETAIL`, `BREADCRUMB`)
- `baseNodeId` — radice del contesto di navigazione (se applicabile)
- `entityId` — identità dell'entità richiesta (se `ENTITY_DETAIL`)
- `search` — termine di ricerca testuale (se presente)
- `entityTypeId` — filtro per tipo di entità (se presente)
- `filters` — filtri strutturati (se presenti, serializzati deterministicamente con chiavi ordinate)
- `sort` — ordinamento (campo + direzione, se presente)

### Elementi esclusi dalla key

La key **non deve mai includere**:
- Cursori di paginazione (`prevCursor`, `nextCursor`)
- Direzione di navigazione (`forward`, `backward`)
- Offset, numero di pagina, limit
- Endpoint URL o query string fisiche
- Timestamp, token di sessione o altri valori effimeri

### Relazione key / pagine

Una singola `SemanticViewKey` identifica l'intera vista. Le pagine (`ViewPage[]`) sono contenute **sotto** la vista come array ordinato. La posizione logica o il chunk corrente non fanno parte dell'identità della vista. Due componenti che dichiarano la stessa key condividono la stessa vista e le stesse pagine.

---

## 3. Service Layer

### ViewResolver

Punto di ingresso unico per ogni richiesta di dati. Riceve un `ViewIntent` (`resolve` o `extend`) e decide se la vista è già soddisfatta in cache o se serve un fetch. Non espone endpoint al chiamante.

### FetchCoordinator

È l'**unico layer autorizzato a conoscere endpoint backend e server actions**. Nessun componente UI, hook adapter o selector può invocare direttamente server actions, fetch, o qualsiasi API di rete. Il FetchCoordinator riceve un intent tipizzato dal ViewResolver e lo traduce nella chiamata backend appropriata.

### IngestionLayer

Riceve i DTO grezzi dal FetchCoordinator e li normalizza:
1. Scompone le entità e le inietta nell'EntityStore canonico tramite `DomainCacheClient.inject()`.
2. Costruisce i `ViewItemDescriptor` (riferimenti opachi agli ID, senza payload).
3. Assembla la `ViewPage` con cursori e flag `hasMore`.
4. Inserisce la pagina nel ViewStore, applicando deduplica cross-chunk e Window Trimming.

---

## 4. Satisfiability (Valutazione della Cache)

Una vista è considerata **soddisfatta** (`satisfied`) se e solo se tutte le seguenti condizioni sono vere:

1. **Esistenza**: la view è presente nel `GlobalViewStore` con almeno una pagina.
2. **Completezza entità**: ogni `ViewItemDescriptor` di tipo `row` ha un'entità corrispondente risolta nell'EntityStore canonico. Se `requireComplete = true`, l'entità non deve essere `isPartial`.
3. **Freshness**: il campo `updatedAt` della vista non supera il TTL di staleness (`STALE_TTL`, default 5 minuti).

Se una qualsiasi condizione fallisce, lo stato è uno tra:
- `missing-view` — la vista non esiste nel ViewStore.
- `missing-entities` — almeno un descrittore referenzia un'entità assente dall'EntityStore.
- `missing-records` — una vista non-entità referenzia un record canonico assente, per esempio un nodo del breadcrumb.
- `partial` — le entità esistono ma alcune sono marcate `isPartial` e il chiamante richiede dati completi.
- `stale` — la vista è presente e completa ma scaduta per TTL.

Il `ViewResolver` invoca il `FetchCoordinator` **solo** quando lo stato non è `satisfied`.

---

## 5. Storage e Cache

### GlobalCacheClient (`AppCache`)

Contenitore dell'EntityStore. Espone cache isolate (`DomainCacheClient`) partizionate per dominio (nodi, entities per `entityTypeId`). Ogni `DomainCacheClient` mantiene:
- **Reference counting** (`retain` / `release`) per tracciare i consumatori attivi.
- **Sottoscrizioni** (`subscribe`) per la reattività push.
- **Promise sharing** (`fetchIfMissing`) per deduplica dei fetch concorrenti sullo stesso ID.

`AppCache` è anche l'unico punto di ingresso per le **mutazioni** (Create, Update, Delete). Vedi §7.

### GlobalViewStore

Contiene lo stato di navigazione delle viste, indicizzato per `SemanticViewKey`. Per ogni vista memorizza un array ordinato di `ViewPage`. Non contiene payload di entità.

---

## 6. Lifecycle: Policy, Window Trimming e GC

### Window Trimming (intra-sessione)

Durante lo scroll continuo, l'`IngestionLayer` applica il trimming per direzione:
- **Scroll forward**: `push` del nuovo chunk, `shift` del chunk più vecchio in testa se `pages.length > maxWindowChunks`.
- **Scroll backward**: `unshift` del nuovo chunk, `pop` del chunk più vecchio in coda.

Dopo un'eviction, il flag `hasMore` del bordo tagliato viene forzato a `true` (il chunk eliminato conteneva dati che il server può ancora restituire). Il cursore del bordo rimane disponibile nella pagina sopravvissuta più esterna.

### Garbage Collection (inter-sessione)

Il `CacheGarbageCollector` esegue sweep periodici sulle viste nel `GlobalViewStore`.

**Regole di eviction delle view:**
- Se nessun lease attivo è registrato per la view → eviction immediata.
- Se esiste almeno un lease `persistent` o `sticky` → la view non viene mai evictata.
- Se tutti i lease sono `windowed` e sono scaduti oltre il TTL → eviction.

Il GC agisce **esclusivamente sul ViewStore**. I descrittori vengono eliminati, i cursori persi.

### Separazione lifecycle EntityStore / ViewStore

> **Regola normativa:** L'eviction di una view dal ViewStore **non comporta** l'eliminazione delle entità referenziate dall'EntityStore.

Le entità canoniche sopravvivono indipendentemente dal ciclo di vita delle viste. Un'entità viene rimossa dall'EntityStore solo tramite:
- Chiamata esplicita a `DomainCacheClient.remove()` (conseguenza di una delete confermata dal backend).
- Reference counting a zero con GC entity-level (non ancora implementato; al momento le entità restano in memoria finché la sessione è attiva).

Motivazione: la stessa entità può essere referenziata da più viste semantiche distinte. Rimuoverla perché una sola vista è stata sfrattata causerebbe inconsistenze nelle altre.

### Retain / Release

I componenti che montano una vista chiamano `GlobalPolicyRegistry.retain('view', viewKey, ownerId, retentionClass)` al mount e `release()` al cleanup. L'`ownerId` è univoco per istanza di hook. Finché almeno un owner mantiene un lease attivo, la view è protetta dall'eviction.

---

## 7. Mutazioni: Create / Update / Delete

Le mutazioni sono orchestrate **esclusivamente da `AppCache`**. Nessun componente UI invoca direttamente server actions di scrittura.

### Create

```ts
await AppCache.createEntity({ parentNodeId, entityTypeKey, name, description, payload });
```

1. Il backend crea il record e restituisce il payload salvato (con ID finale e `rowVersion`).
2. `AppCache` inietta il record nell'EntityStore canonico.
3. La vista lista rilevante viene **invalidata** (`GlobalViewStore.delete(listKey)`), non patchata.
4. Al successivo mount o resolve, il ViewResolver rileva `missing-view` e ricarica la lista dal server con l'ordinamento corretto.

Motivazione: la posizione del nuovo record nella lista dipende dall'ordinamento server-side. L'inserimento client-side sarebbe probabilistico e potenzialmente inconsistente.

### Update

```ts
await AppCache.updateEntity({ entityId, name, payloadDelta, expectedRowVersion });
```

1. Il backend aggiorna e restituisce il payload salvato.
2. `AppCache` inietta il record aggiornato nell'EntityStore tramite `inject()`.
3. Tutti i subscriber (liste, dettagli, form) ricevono il nuovo dato via push. Nessun refetch.

### Delete

```ts
await AppCache.deleteEntity(entityId, entity.entityTypeId, entity.rowVersion);
```

1. Il backend elimina il record.
2. `AppCache` chiama `DomainCacheClient.remove(entityId)`, che elimina l'entry dall'EntityStore e notifica tutti i subscriber con `null`.

#### Comportamento dei descrittori orfani dopo delete

Dopo una delete, il ViewStore può contenere descrittori che puntano a entità eliminate (l'EntityStore restituisce `null` per quegli ID). Questi descrittori orfani sono gestiti come segue:

1. **Stato transitorio tollerato**: i descrittori non vengono rimossi immediatamente dal ViewStore.
2. **Filtro a livello di selector**: il selector `useVirtualSubtreeData` (nel `useMemo` che costruisce `items`) verifica la presenza dell'entità nell'EntityStore con `if (entity)`. Se l'entità è `null`, il descrittore viene **silenziosamente escluso** dall'array degli items renderizzati. Questa è responsabilità del selector, non della UI né del motore.
3. **Compattazione differita**: i descrittori orfani vengono eliminati naturalmente alla successiva invalidazione, refresh o GC della vista. Non esiste un meccanismo di compattazione attiva immediata.

---

## 8. Hook Ufficiali (UI Layer)

I componenti React comunicano con l'engine **esclusivamente** tramite questi hook adapter.

### `useVirtualSubtreeData` — Liste e Paginazione

Per liste, griglie e alberi virtuali.
- **Input**: `baseNodeId`, filtri opzionali (`search`, `entityTypeId`), ref per l'ancoraggio scroll.
- **Output**: `items` (array piatto pronto per il virtualizer), `loadMoreForward`, `loadMoreBackward`, flag di stato (`isLoading`, `hasMoreForward`, `hasMoreBackward`, `isError`).
- Si aggiorna in tempo reale se il dato canonico cambia nell'EntityStore.

### `useSemanticEntityDetail` — Dettaglio e Form

Per componenti single-record.
- **Input**: `entityId`, contesto opzionale.
- **Output**: `entity`, `isLoading`, `error`.
- Legge dall'EntityStore canonico. Qualsiasi update o delete sullo stesso ID si riflette istantaneamente.

### Divieti

- **Vietato** utilizzare `useReadModel`, `ReadModelContext` o qualsiasi context legacy per nuove implementazioni.
- **Vietato** invocare server actions direttamente da componenti UI per operazioni di lettura o scrittura.
- **Vietato** creare cache locali (`useState` con fetch in `useEffect`) per dati che appartengono all'EntityStore.

## 8. Identità e Controllo Accessi

### Zero-Trust UI
Il client React è un ambiente non attendibile. La UI non possiede l'identità dell'utente. Le chiavi semantiche (`SemanticViewKey`) e i payload non contengono mai l'`actorUserId`.

### Risoluzione Esclusiva Backend
L'identità deve essere risolta in backend (FetchCoordinator / AuthResolver) tramite meccanismi di sessione sicuri (Cookie/Token) e tradotta in un contesto interno.

### Data Masking Nativo (Filtro SQL)
L'estrazione dei dati è strettamente vincolata all'identità. Il filtraggio dei record visibili avviene esclusivamente a livello di database (Query Ports), integrandolo prima di qualsiasi logica di paginazione o cursore. 
È vietato applicare filtri di visibilità in memoria sull'Application Layer.

### Single Source of Truth per ACL
La semantica di autorizzazione (`allow/deny`, propagazione gerarchica `ltree`) esiste in un unico punto dell'infrastruttura. I Query Port di lettura e le guardie di scrittura consumano le medesime primitive SQL.

## 9. Session Lifecycle & Cache Eviction

### Tabella Sessioni e Identità
L'identità e la validità dell'accesso sono gestite statefulmente tramite la tabella `user_sessions` su database. Il client mantiene esclusivamente un token opaco in un cookie HTTP-Only; il server salva e confronta soltanto il suo hash. Il JWT di NextAuth è un involucro di trasporto della sessione applicativa, non la fonte autorevole dell'autorizzazione: ogni richiesta viene verificata contro `user_sessions`.

### Cache Eviction
È severamente proibito conservare dati in cache (sia `EntityStore` che `ViewStore`) appartenenti a una sessione o un utente precedentemente loggato.
La primitiva formale di Full Reset è `AppCache.purgeAll()`.
- **Trigger Primario:** Deve essere invocata al momento del **logout completato con successo** (per via programmatica dal frontend).
- **Cintura Difensiva:** Il caricamento della root route di login (`/login`) deve obbligatoriamente chiamare la pulizia globale (`purgeAll()`) al primo mount per sanificare residui o scenari edge (timeout silente o redirezione forzata da middleware).
- Quando la cache esegue `purgeAll()`, sia la Map delle entità che le ViewKey subiscono uno sweep totale (distruzione in RAM locale).
