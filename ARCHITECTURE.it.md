# ARCHITECTURE.md

[Italiano](ARCHITECTURE.it.md) | [English](ARCHITECTURE.md)

> **Stato: normativo per l'implementazione corrente.** Quando questo documento,
> `docs/` e un documento storico divergono su architettura runtime, contratti,
> persistenza, realtime o sicurezza, prevalgono questo documento e il relativo
> documento operativo in `docs/`. I requisiti storici restano input di prodotto
> e devono essere riconciliati esplicitamente prima di cambiare il contratto.

## Scopo

Questo documento fissa la mappa dei layer, le regole di dipendenza e il
posizionamento delle responsabilità di Dashboard V2, così che il lavoro nuovo
non riapra continuamente decisioni strutturali già prese. L'obiettivo è
definire dove appartiene ogni responsabilità prima del codice, riducendo cicli
di progettazione e impedendo che dettagli Infrastructure filtrino in
Application o Domain.

Nodriva è un monolite modulare con confini interni espliciti, definizioni di
tipo dinamiche, tabelle relazionali dedicate, ricostruzione dello schema a
runtime e frontend/read model configurabile invece di un layout fisso.

Nodriva è una piattaforma scaricabile configurata dall'operatore, non un SaaS
gestito. La persistenza è obbligatoria: sono supportati PostgreSQL, anche
esterno, e SQLite standalone. Compose è un profilo di riferimento/test, non una
dipendenza applicativa. Le integrazioni opzionali e la distinzione tra garanzie
Application e responsabilità dell'operatore sono normative in
[`docs/DEPLOYMENT_MODEL.md`](docs/DEPLOYMENT_MODEL.md).

## Principio fondamentale

Le dipendenze puntano sempre verso l'interno: Presentation dipende dai
contratti Application, Application dipende da Domain e port, Infrastructure
implementa i port senza diventare fonte delle regole di business.

Le regole vincolanti per ownership delle policy, contratti completi, mutazioni
atomiche e parità degli adapter sono in
[`docs/ARCHITECTURAL_GOVERNANCE.md`](docs/ARCHITECTURAL_GOVERNANCE.md).

Una sezione è realmente chiusa solo quando è fissato anche il suo
posizionamento trasversale: bounded context, layer, dipendenze ammesse e
vietate, effetti post-commit. Questo documento rende espliciti tali confini.

## Bounded context

| Contesto | Responsabilità |
|---|---|
| Hierarchy | Nodi, struttura padre/figlio, spostamenti, semantica subtree |
| Type System | NodeType, EntityType, campi, vincoli, ricostruzione schema, amministrazione tipi |
| Entity Domain | Istanze entità, validazione payload tipizzato, orchestrazione CRUD |
| Relationships | Edge tipizzati, cardinalità, proiezioni inverse e deletion policy |
| Identity & Access | Utenti, ruoli, scope, sessioni, autorizzazione |
| Governance | Audit, revisioni, lock, concorrenza ottimistica |
| Frontend Read Model | Store client normalizzato, cache per pagina, dati composizione viste |
| Administration | Configurazione sistema, capability, selezione profilo runtime |
| Workflow | Cataloghi eventi generici, definizioni, pianificazione idempotente e contratti azioni |

Questi contesti sono zone di riferimento stabili anche quando evolvono classi,
adapter o tabelle concrete.

### Configurazione dei servizi amministrativi

`ServiceConfigurationRegistry` è un catalogo Application di contratti, non una
fonte dei valori di deployment. `ServiceConfigurationService` risolve
deployment, policy runtime, riferimenti ai secret e stato derivato secondo la
precedenza del provider; un record runtime non può selezionare un altro
provider. I servizi opzionali risolvono esplicitamente a `disabled` quando non
configurati. `ServiceAdministrationApplicationService` è il read model Admin
autorizzato e sanificato e può eseguire healthcheck non mutanti.
`BackupStatusPort` opzionale espone solo evidenza recovery redatta prodotta da
un adapter operativo; non può avviare backup o restore. Il read model non deve
esporre topologia endpoint, path, riferimenti secret o valori secret.
Gli healthcheck sono effetti operativi, mai parte della transazione di
configurazione.

## Layer tecnici

### Domain

**Scopo:** contenere concetti business, invarianti, regole sui valori ed errori
semantici senza dipendere da framework, trasporto o storage.

**Dipendenze:** nessuna esterna.

**Ammesso:** modelli Domain, value object, validazione pura ed errori Domain.

**Vietato:** SQL, `pg`, HTTP, API framework, cache, compilazione schema legata
al database e preoccupazioni UI.

**Esempi:** `ManagedTypeDefinition`, `ManagedTypeField`,
`ManagedTypeFieldConstraint`, `TypeAdminErrors`, `SchemaErrors`.

### Application

**Scopo:** orchestrare casi d'uso e coordinare oggetti Domain con i port.
Possiede comandi, servizi applicativi, transazioni, sequenza post-commit e
flusso di validazione alto livello.

**Dipendenze:** Domain e port Application.

**Ammesso:** servizi, use case, comandi, DTO, port, orchestrazione, confini
transazionali e trigger di invalidazione post-commit.

**Vietato:** SQL diretto, tipi PostgreSQL, dettagli runtime framework e codice
degli adapter.

**Esempi:** `TypeAdminApplicationService`, `NodeApplicationService`,
`EntityApplicationService`, `SchemaRegistry`, `TypeDefinitionReader`,
`TypeDefinitionAdminRepository`, `TransactionPort`, `IdGeneratorPort` e
`SchemaInvalidationPort`.

### Infrastructure

**Scopo:** implementare i port Application con tecnologie concrete come
PostgreSQL, registry cache, esecuzione DDL, messaggistica esterna e compilazione
schema concreta.

**Dipendenze:** contratti Application e tipi Domain quando necessari.

**Ammesso:** adapter PostgreSQL, adapter DDL, implementazioni cache/registry,
bridge e connettori di servizi esterni.

**Vietato:** decidere policy business, essere chiamata direttamente da
Presentation o ridefinire silenziosamente regole Application.

**Esempi:** `TypeDefinitionReaderPostgres`,
`TypeDefinitionAdminRepositoryPostgres`, `CachingSchemaRegistry`,
`FieldSchemaCompiler`, `EntitySchemaRegistryBridge` e
`SchemaInvalidationAdapter`.

### Presentation / Frontend

**Scopo:** rendere UI, raccogliere input, guidare flussi utente e mantenere read
model/cache normalizzati derivati dai contratti backend, non dalla persistenza
diretta.

**Dipendenze:** soli contratti Application/API esposti.

**Ammesso:** componenti, configurazione viste, store, cache per pagina, routing
e composizione.

**Vietato:** accesso DB diretto, assunzione di comportamento fisso tree/list,
regole di persistenza incorporate e bypass della fonte backend.

**Esempi:** store read model, cache paginata, widget configurabili e viste
tree/list/detail configurate da regole di sistema.

## Regole di dipendenza

1. Domain non conosce Application, Infrastructure o Presentation.
2. Application coordina Domain e port, ma non importa adapter PostgreSQL o
   framework concreti.
3. Infrastructure implementa port, ma non diventa fonte delle decisioni
   business.
4. Presentation parla con contratti backend/Application, mai con database o
   interni Infrastructure.
5. Effetti post-commit, come invalidazione schema, avvengono solo dopo commit
   riuscito e mai nel corpo della transazione DB.
6. Single-user e multi-user sono profili della stessa applicazione, non
   architetture separate.

## Matrice di posizionamento

| Componente | Layer | Dipende da | Vietato |
|---|---|---|---|
| `NodeApplicationService` | Application | Domain, Port | SQL diretto, `pg`, logica UI |
| `EntityApplicationService` | Application | Domain, port schema | SQL diretto, compiler concreto |
| `TypeAdminApplicationService` | Application | Domain, port, comandi | `pg`, generazione DDL, codice adapter |
| `SchemaRegistry` | port Application | — | cache concreta |
| `TypeDefinitionReader` | port Application | — | implementazione PostgreSQL |
| `TypeDefinitionAdminRepository` | port Application | — | corpi SQL |
| `TransactionPort` / `IdGeneratorPort` | port Application | — | regole business |
| `CachingSchemaRegistry` | Infrastructure | port Application, DTO | accesso UI, policy business |
| `FieldSchemaCompiler` | Infrastructure pura | DTO | accesso DB |
| `TypeDefinitionReaderPostgres` | Infrastructure | `pg`, contratto port | chiamate Presentation |
| `TypeDefinitionAdminRepositoryPostgres` | Infrastructure | `pg`, contratto port | uso diretto UI |
| `SchemaInvalidationAdapter` | Infrastructure | `SchemaRegistry` | invalidazione prima del commit |
| `EntitySchemaRegistryBridge` | Infrastructure | `SchemaRegistry` | nuova logica business |
| `StorageTableManagementPort` | port Application | — | diventare framework migrazioni generico |
| `StorageTableManagementPostgres` / `StorageTableManagementSqlite` | Infrastructure | port DDL, metadata, validazione identificatori | interpolazione arbitraria |
| `ResourceRelationshipService` | Application | port risorse/tipi/ACL e transazione | SQL, stato UI, logica adapter |
| `RelationshipMutationPlanner` | Application | preview validata batch relazione | scritture, stato UI, ownership lock |
| `RelationshipMutationCommitter` / `ResourceRelationshipMutationWriter` | Application | scritture transazionali confermate, audit, revisioni | SQL o sostituzioni client |
| `RelationshipMutationImpactPolicy` | Domain | cardinalità e semantica replace pure | persistenza, ACL, framework |
| `ResourceRelationshipRepositoryPostgres` / `ResourceRelationshipRepositorySqlite` | Infrastructure | port persistenza relazioni | policy autorizzazione/cardinalità |
| Read model e coordinator mutation frontend | Presentation | contratti API, cache normalizzata | DB, layout fisso, policy duplicate |
| Adapter audit/revisioni | Infrastructure | port Application | decidere rilevanza policy |
| `WorkflowPlanner` / `WorkflowDefinitionService` / `WorkflowEventFactory` / `WorkflowEventProcessor` / `WorkflowWorker` | Application | eventi/definizioni workflow Domain, port | SQL, adapter, runtime framework |

## Regole trasversali

### Transazioni ed effetti

Le mutation critiche seguono la stessa sequenza: validazione input strutturale,
inizio transazione, persistenza/aggiornamento, commit, effetti post-commit come
invalidazione schema o propagazione evento.

Le write dipendenti da autorizzazione ripetono il controllo autorevole nella
transazione che persiste dato e audit. PostgreSQL acquisisce lock advisory
condiviso sulla policy autorizzativa; mutazioni di ruolo, scope, permessi e
identità acquisiscono la controparte esclusiva. SQLite ottiene lo stesso esito
osservabile con il proprio confine transazionale serializzato.

### Risoluzione schema dinamico

Gli schemi dinamici hanno un percorso unico per `node` ed `entity`:
`TypeDefinitionReader` carica la definizione attiva non tombstoned,
`FieldSchemaCompiler` produce lo schema Zod e `CachingSchemaRegistry` lo mette
in cache per `domain:typeKey`. `EntitySchemaRegistryBridge` adatta il registry
unificato al port più stretto del servizio entità. Le mutation type-admin
invalidano lo stesso registry dopo il commit tramite
`SchemaInvalidationAdapter`; non esistono compiler o cache entity paralleli.

I vincoli regex sono validati alla scrittura: devono essere espressioni
JavaScript valide, lunghe al massimo 512 caratteri e superare l'analisi statica
`safe-regex2`. Un'espressione rifiutata non viene persistita da nessun adapter.

### Contratti adapter

SQLite e PostgreSQL implementano gli stessi port Application. I test di
contratto condivisi usano un database SQLite reale e il database PostgreSQL di
integrazione dedicato. La suite copre schema runtime e ACL, round-trip nodi/
entità, ordinamento, concorrenza ottimistica, delete/restore subtree, riuso path,
transazioni, lock, quota allegati e rate limit upload. Un E2E browser avvia
entrambi i profili con dati isolati e confronta navigazione, mutation, dettagli
e audit del pannello Admin.

I comandi allegati appartengono a `AttachmentApplicationService`, riusano il
servizio di edit nodo/entità per lock posseduti dalla sessione e `rowVersion`, e
committano insieme metadata, audit e outbox realtime attivo. SQLite serializza
ogni accesso async tramite il gate posseduto dalla connessione, anche fuori da
una transazione Application esplicita; `BEGIN IMMEDIATE` rilascia ownership
prima degli effetti post-commit.

I servizi che consumano password dipendono da `PasswordHasherPort`. La
composition root fornisce l'implementazione crypto Infrastructure; Domain non
importa crypto Node.js. Gli hash password esistenti restano compatibili.

### Identità, scope e permessi delegati

Identità e `user_roles` sono globali nel modello dati corrente. Modifiche ai ruoli
globali e privilegi superadmin sono quindi riservati ai superadmin. Un admin
locale crea identità tramite il flusso atomico `createScopedUser`: nessun ruolo
amministrativo globale e una o più assegnazioni iniziali `allow` nella stessa
transazione e audit.

`default_reader` è il ruolo baseline posseduto dall'applicazione per ogni utente
creato e sostituzione degli assignment globali. I servizi passano il set di
ruoli normalizzato completo a entrambi gli adapter; gli adapter non aggiungono
ruoli impliciti.

Il confine di gestione locale è calcolato in PostgreSQL, mai in memoria.
Contiene solo grant `scope.assign` attivi con propagazione `subtree` il cui
intero subtree resta consentito dopo i deny dell'attore. Un admin locale legge
o modifica solo identità non-superadmin con almeno uno scope allow e ogni allow
entro quel confine; identità senza scope e utenti con ruoli globali sono
intenzionalmente invisibili. `self` non autorizza mai un subtree. Un deny
esclude l'area sovrapposta. Liste/dettagli/update/delete scope usano la stessa
query, mentre cataloghi ruolo/permesso restano superadmin-only.

I grant delegati non sono durevoli dopo la perdita dell'autorità. Ogni mutation
scope e ruolo-permesso riconcilia assignment con `assigned_by`; disabilitare un
delegator fa lo stesso. PostgreSQL verifica copertura e cascata iterativa,
rimuovendo grant finché non restano discendenti invalidi. Ogni rimozione
automatica è scritta come `security.revoke_delegated_scope` con la ragione.
Righe legacy con `assigned_by IS NULL` sono system-owned e richiedono revisione
superadmin esplicita.

I comandi Admin hanno una classe scope esplicita: cataloghi ruolo/permesso e
ruoli globali sono globali; comandi nodo/entità sono node-bound; grant scope
sono coverage-bound; lista/dettaglio/stato utente sono management-bound. RLS
PostgreSQL non è attivo sulla connessione condivisa perché non riceve in modo
sicuro l'attore per request. La difesa è una credenziale applicativa ristretta
senza accesso diretto alle tabelle fuori dagli adapter; RLS futuro richiede
setting transazionale dell'attore e test deny/coverage.

### Sistema schema runtime

La ricostruzione schema parte da definizioni relazionali in tabelle dedicate,
non da un unico blob JSON, per privilegiare performance, integrità, governance
esplicita e compilazione da metadata strutturati.

### Composizione frontend

Il frontend deve essere configurabile. Tree, list, detail, breadcrumb e
componenti correlati sono consumer configurabili di read model/cache condivisi,
non primitive architetturali fisse.

Le viste semantiche conservano riferimenti ordinati e tipizzati (`namespace`,
`id`, completezza richiesta) a record canonici, non ID non tipizzati o payload
copiati. La soddisfazione della vista è calcolata genericamente; record mancanti
sono hydrate tramite contratti backend autorizzati e cambi membership/ordine
invalidano token di dipendenza.

I file `page.tsx` e `layout.tsx` dell'App Router sono boundary di composizione:
risolvono parametri e assemblano screen, ma non possiedono state, effect,
reducer o transizioni. Stato e orchestrazione appartengono a hook/controller;
rendering a screen e section component. Il test Web impone 60 righe e rifiuta
hook React di stato/effect nelle route. I form dinamici nodo/entità condividono
coercizione, inizializzazione, validazione allegati e upload.

I flussi di creazione routed separano origine navigazione e relazione usata per
creare. Usano il contratto validato di return-context: dopo save o annullamento
si torna alla pagina di apertura, mai implicitamente al parent. URL diretto usa
fallback locale esplicito. I target sono path interni validati prima della
navigazione e non possono diventare open redirect.

### Amministrazione tipi e DDL

Gestione metadata amministrativi e DDL fisico sono responsabilità distinte.
Possono essere orchestrati da Application, ma repository write-side e
generazione DDL restano separati da port.

## Regola per nuovi componenti

Prima di implementare un componente scrivere:

1. bounded context;
2. layer tecnico;
3. dipendenze ammesse;
4. dipendenze vietate;
5. esecuzione dentro transazione, post-commit o entrambe;
6. port esistente implementato o nuovo port richiesto.

Se i sei punti non sono chiari, il componente non è pronto. La regola evita
cicli di progettazione infiniti causati dal posizionare responsabilità dopo
l'inizio del codice.

## Uso pratico

`ARCHITECTURE.md` è il documento canonico di posizionamento del repository.
Aggiornarlo solo quando nasce una responsabilità architetturale realmente nuova,
non quando cambia un dettaglio interno d'implementazione.
