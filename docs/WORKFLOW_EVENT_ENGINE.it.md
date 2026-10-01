# Motore generico di eventi workflow

Il bounded context Workflow è una capability generica del Core: accetta eventi
da qualunque tipo di soggetto, non solo nodi o entità. I modelli Domain
definiscono envelope evento immutabili e definizioni workflow versionate;
`WorkflowPlanner` è puro e deterministico. `WorkflowRepository` persiste
cataloghi eventi, definizioni, istanze e record di idempotenza. Gli adapter
PostgreSQL e SQLite devono mantenere gli stessi esiti osservabili di esecuzione,
ordinamento, autorizzazione e retry.

`WorkflowEventProcessor` è il confine Application usato dai producer. Dentro
una transazione `TransactionPort` verifica che il tipo evento sia attivo e
accetti il tipo soggetto generico, registra l'evento una sola volta, seleziona
le definizioni attive compatibili e persiste un piano per versione workflow e
chiave di idempotenza evento. Un duplicato è un no-op riuscito e non pianifica
lavoro duplicato.

`WorkflowDefinitionService` è il confine di configurazione. Valida versioni,
trigger e step non vuoti e unici e verifica che ogni trigger abbia un contratto
evento registrato prima di scrivere la definizione. Un tipo evento inattivo può
essere configurato in anticipo ma non processato prima dell'abilitazione.

I record durevoli correnti sono volutamente generici:

- catalogo eventi: tipo evento, tipi soggetto ammessi e versione payload;
- definizione: trigger versionato, condizioni e input tipizzati delle azioni;
- evento: envelope immutabile, metadati correlazione/causazione e riferimento
  soggetto;
- piano esecuzione: chiave stabile istanza workflow e step deterministici.

Il test d'integrazione SQLite usa un soggetto custom `asset` e un attore di
integrazione, non un nodo o un'entità Nodriva. Dimostra che registrazione,
configurazione, pianificazione, lease, esecuzione e soppressione dei duplicati
sono riutilizzabili come capability Core.

Gli eventi devono essere persistiti con mutazione business e audit prima della
consegna. Realtime è un consumer dell'outbox durevole della mutazione; planning
ed esecuzione workflow sono consumer separati e idempotenti e non girano nella
transazione di scrittura. `WorkflowWorker` prende in lease gli step persistiti,
invoca un `WorkflowActionHandler` registrato e completa o riprova il singolo
step con backoff esponenziale. Un handler riceve la sua `executionKey` stabile e
deve passarla ai sistemi downstream che supportano idempotenza. Gli adapter
azione non vanno inseriti nella definizione workflow né accoppiati a
Pusher/realtime.

## Prima azione e operazione integrate

`audit.record` è il primo handler interno. Crea una voce compatta
`workflow.audit.record` per qualunque tipo di soggetto origine, attribuita
all'utente originale quando è un utente Nodriva. La traccia immutabile contiene
workflow id/versione, execution key e correlazione evento, ma non copia il
payload evento. I riferimenti alla risorsa audit sono testuali e non richiedono
una nuova migrazione per ogni modulo futuro; uno scope nodo viene collegato solo
quando l'evento contiene un UUID Nodriva valido.

Nel deployment PostgreSQL completo il worker autenticato esistente chiama
`POST /api/internal/workflows/drain` insieme al drain realtime. Ogni chiamata
reclama al massimo 100 step. `GET /api/internal/workflows/metrics`, protetta
dallo stesso secret del worker, espone a Prometheus misure durevoli di pending,
lease, retry, età del pending più vecchio e numero massimo di tentativi. SQLite
mantiene lo stesso contratto di repository e worker; un host standalone può
invocare lo stesso servizio applicativo dal proprio scheduler locale senza un
nuovo servizio.

## Catalogo iniziale dei producer

La verticale canonica pubblica questi contratti generici dai servizi Application
di Node ed Entity: `record.created`, `record.updated`, `record.deleted`,
`record.restored` e `hierarchy.moved`. Portano riferimento soggetto generico,
chiave tipo quando nota, correlazione attore/sessione, versione riga o metadati
batch e non copiano payload dinamico nella workflow event. I primi quattro
accettano soggetti `node` ed `entity`; `hierarchy.moved` accetta al momento
`node`.

Un delete o restore subtree ha esattamente un record audit causale e un evento
workflow: entrambi fanno riferimento al nodo scelto dall'utente, mentre
discendenti ed entità contenute sono conseguenze immutabili identificate da
`deletionBatchId`. Il payload contiene identificativo root e conteggio nodi
coinvolti; non emette un record event generico per ogni discendente. Uno
spostamento gerarchico segue la stessa regola: un evento `hierarchy.moved` per
la root selezionata, mentre revisioni per nodo restano storia interna poiché
cambiano path e `rowVersion` di ogni discendente.

Il catalogo è installato in modo idempotente dalla migrazione PostgreSQL 036 e
dal bootstrap schema SQLite. Non crea definizioni workflow né azioni esterne:
amministratori autorizzati o installer di modulo devono configurarle
esplicitamente. Il confine amministrativo richiede `system.config.read` per
ispezionare cataloghi/definizioni e `system.config` per registrare un tipo
evento o pubblicare una definizione.

Le coppie pubblicate `(workflowId, version)` sono immutabili. Cambiare un
workflow significa pubblicare una nuova versione e ogni mutazione di catalogo o
definizione viene registrata nell'audit. Al massimo una versione di un
identificativo è attiva: pubblicarne una nuova disattiva atomicamente la
precedente, mentre i piani esistenti mantengono la versione che li ha creati.
La migrazione PostgreSQL 038 corregge duplicati storici mantenendo la versione
maggiore; SQLite fa lo stesso nel bootstrap idempotente. L'amministratore può
pubblicare solo action type installati nel deployment; l'azione iniziale sicura
è `audit.record`.

Altri moduli usano lo stesso port `WorkflowEventPublisher` e possono registrare
un diverso tipo di soggetto o evento senza modificare il motore.

## Esperienza amministrativa

Configurare un workflow è un'attività amministrativa, non una console per
sviluppatori. La UI presenta tipi evento e action installate tramite cataloghi
semantici autorizzati (nome localizzato, spiegazione e tipi soggetto supportati)
ma invia identificativi tecnici stabili al confine Application.

Distingue nome umano del workflow e chiave tecnica immutabile, guida da intento a
trigger, azione e condizioni opzionali e conserva le bozze nel workspace Admin.
Le nuove chiavi workflow e step usano `snake_case` minuscolo; le chiavi legacy
restano leggibili ed eseguibili. Un grafo visuale si introduce solo quando rami
e dipendenze rendono ambiguo l'editor lineare; non sostituisce validazione,
autorizzazione, versionamento o storia esecuzioni.

La regola generale, inclusi filtri audit e altri moduli Admin, è definita in
[`ADMINISTRATIVE_UX_SEMANTIC_CATALOGS.md`](./ADMINISTRATIVE_UX_SEMANTIC_CATALOGS.md).
