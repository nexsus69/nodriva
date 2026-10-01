# Trade-off conosciuti

Questo documento registra i trade-off architetturali accettati che potranno
essere ottimizzati in futuro senza cambiare le invarianti correnti.

## Invalidazione per faccia di una risorsa estendibile

Entità, nodi e risorse analoghe hanno una parte comune e facce specialistiche,
come payload dinamico, relazioni e allegati. L'aggregato mantiene volutamente un
solo `rowVersion` autorevole per lock, scritture condizionali e conflitti: ogni
modifica a una faccia deve impedire il salvataggio di una copia precedente.

La cache può quindi invalidare una proiezione più ampia del necessario quando
cambia solo un campo dinamico mentre una lista usa nome e metadati comuni. È un
costo di efficienza accettato, non un difetto di correttezza né un prerequisito
della verticale corrente.

Quando il carico osservato lo giustificherà, introdurre `ResourceChangeDescriptor`:
la mutazione continuerà ad aggiornare il solo `rowVersion`, ma dichiarerà le
facce cambiate. Una policy di cache potrà invalidare soltanto le proiezioni
dipendenti da quelle facce. Il primo pilot dovrà riguardare le entità e coprire
concorrenza invariata, cache hit della lista comune e refresh del dettaglio,
prima di estendersi a relazioni e allegati.

## Coordinatori frontend complessi

Il refactoring ha reso `page.tsx` e `layout.tsx` boundary sottili di
composizione e ha separato screen, sezioni e hook/controller. La dimensione di
un file non dimostra da sola un difetto: il refactoring deve seguire
responsabilità e invarianti osservabili e conservare i test di sessione/lock,
scroll/resize e navigazione/realtime. Il limite automatico di 60 righe riguarda
le route, non questi controller.

Il rilievo su `ActivityProvider` è risolto: il componente compone il
controller, mentre reducer, gate temporale/registro lock, protocollo HTTP e
binding browser hanno moduli e test indipendenti. Il contratto osservabile di
sessione scorrevole e rinnovo lock è invariato.

Anche `VirtualGroupedTable` è stato separato in controller UI e corpo
presentazionale; grouping, selezione, sentinel, observer e compensazione dello
scroll sono isolati e testati. La finestra paginata resta governata dalla cache
semantica e da `useVirtualSubtreeData`, senza una seconda finestra locale.

Il boundary di `NodeTree` compone il controller dello stato espanso e il ramo
ricorsivo. Il caricamento resta lazy tramite `useSemanticNodeList` e il record
canonico proviene da `useCachedNode`; i test coprono espansione, selezione,
caricamento e realtime senza una seconda cache.

## Access control e sottoquery LTree

Il filtraggio PostgreSQL in lettura è centralizzato in
`AccessControlPortPostgres.getReadAccessControlSql`. La migrazione
`004_materialized_scope_node_path.sql` aggiunge `node_path` a
`node_scope_assignments`, lo mantiene con trigger e consente all'adapter ACL di
usare direttamente `nsa.node_path @> target.path`, sostenuto da indici GiST.
La ridondanza è valida solo perché aggiornata nella stessa transazione; non va
modificata dall'application layer.

La navigazione diretta e le virtual root applicano il filtro `node.read` in una
query set-based PostgreSQL. L'ottimizzazione della sottoquery LTree è quindi
chiusa con il path materializzato.

## Sessione stateful

La piattaforma usa la tabella `user_sessions` con token opaco nel cookie. Una
query per chiave primaria è trascurabile rispetto alle query ACL LTree e consente
revoca immediata lato server, a differenza di JWT senza denylist. Ogni lock è
legato alla sessione esatta tramite `session_id`; logout e cancellazione della
sessione producono rilascio esplicito e cascata di sicurezza.

Il token originale resta solo nel cookie HTTP-only. `AuthApplicationService` ne
calcola l'hash SHA-256 prima del salvataggio e confronta l'hash anche in
risoluzione e logout; un dump del database non espone token utilizzabili.

## Intercettazione 401

`AppCache` intercetta gli errori 401 sia nelle aggregazioni gestite da
`FetchCoordinator` sia nelle mutazioni e nei fetch di dettaglio gestiti da
`GlobalCacheClient`. Le chiamate fuori dal Semantic Cache Engine non sono
automaticamente coperte; il contratto UI richiede quindi l'uso delle primitive
`AppCache`, che garantiscono purge immediato e messa in sicurezza dei client.
