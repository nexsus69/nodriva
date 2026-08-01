# Dashboard V2 — Specifica architetturale consolidata v4

## 1. Scopo

Dashboard V2 è una piattaforma gestionale gerarchica generica, progettata per organizzare nodi ed entità in una struttura padre/figlio flessibile, con supporto a tipi dinamici definiti dall’amministrazione e a comportamenti configurabili sia lato backend sia lato frontend [cite:37][cite:26]. L’obiettivo del sistema non è implementare un caso d’uso rigido, ma costruire una base architetturale stabile, riusabile ed estendibile, capace di adattarsi a domini diversi senza dover essere riscritta ogni volta [cite:54][cite:27].

Il sistema deve poter funzionare nella stessa base applicativa sia in modalità locale semplificata sia in modalità più collaborativa, variando capability e configurazioni senza cambiare il core dell’applicazione [cite:117]. Questa impostazione richiede che i comportamenti sensibili — persistenza, locking, realtime, composizione UI, visibilità dei componenti e politica di presentazione — siano trattati come capability e configurazioni, non come assunzioni rigide del codice [cite:117][cite:54].

## 2. Regole fondative

Il cuore del sistema è una gerarchia di nodi che può contenere figli misti: altri nodi oppure entità di tipi diversi, dove le entità si comportano come foglie della struttura [cite:36][cite:37]. Ogni entità deve avere un tipo, campi comuni condivisi e campi specifici del proprio tipo, mentre sia i tipi di entità sia la struttura dei campi devono poter essere definiti e amministrati via interfaccia dagli amministratori del sistema [cite:26].

La progettazione deve privilegiare performance, sicurezza, tracciabilità e chiarezza architetturale, evitando scorciatoie che concentrino struttura, validazione e query in campi JSON generici [cite:26]. Per questo il modello deve preferire strutture relazionali esplicite, tabelle dedicate per tipo, validazione runtime compilata a partire dalle definizioni persistite e responsabilità ben separate tra dominio, servizi applicativi, persistenza e presentazione [cite:26][cite:30].

## 3. Runtime modes e capability configuration

L’applicazione deve essere concepita come un unico sistema distribuibile in più profili operativi, non come due prodotti separati [cite:117]. La variante single-user/local edition e quella multi-user/collaborativa condividono dominio, modello persistente, contratti e servizi applicativi, ma differiscono per capability abilitate, adapter infrastrutturali e livello di enforcement di certe funzioni concorrenti [cite:117].

Capability come lock distribuito, realtime bus, adapter di persistenza avanzati, audit esteso o composizioni UI specializzate devono essere attivabili o disattivabili per configurazione [cite:117][cite:54]. Il sistema deve quindi essere costruito in modo che l’assenza di una capability non rompa il flusso principale, ma lo faccia degradare in maniera esplicita e controllata verso un comportamento più semplice [cite:117].

## 4. Realtime ed event propagation

Le modifiche di stato rilevanti devono essere trattate come eventi di dominio e applicazione, propagabili ai componenti interessati senza accoppiare direttamente i moduli tra loro [cite:117]. Anche quando il realtime non è abilitato, il sistema deve ragionare in termini di eventi interni, così che cache, viste derivate, invalidazioni e aggiornamenti locali possano reagire in modo coerente alle operazioni eseguite [cite:117].

In configurazioni più semplici, la propagazione può limitarsi a invalidazioni locali, refresh mirati o notifiche interne di processo; in configurazioni collaborative, la stessa semantica deve poter essere estesa a un bus realtime o a un canale di sincronizzazione senza ridefinire i contratti del dominio [cite:117]. Gli eventi devono essere considerati strumenti di coerenza e sincronizzazione, non una scorciatoia per trasferire logica di business fuori dai servizi applicativi [cite:54].

## 5. Architettura

Dashboard V2 deve essere progettata come modular monolith a layer, in cui il dominio gerarchico e il sistema dei tipi entità restano indipendenti da UI, database concreto e servizi esterni, così da poter sostituire o disattivare capability infrastrutturali senza riscrivere il cuore dell’applicazione [cite:54][cite:117]. Il backend funge da source of truth per dati, permessi, scope, validazione e propagazione degli eventi, mentre il frontend incarna un read model derivato, ottimizzato per rendering veloce e coerenza locale [cite:34].

Il sistema deve essere organizzato in bounded context chiaramente separati: Hierarchy domain per la gestione di nodi e alberi, Entity type system per la definizione di tipi, campi, vincoli e riferimenti, Access control & administration per ruoli, permessi e pannello amministrativo, Runtime capabilities per persistenza, realtime, locking e altri servizi infrastrutturali opzionali, e Frontend read model per cache, stato e rendering [cite:54]. Ogni contesto deve comunicare con gli altri tramite interfacce stabili e contratti applicativi ben definiti, non tramite accoppiamenti diretti su dettagli implementativi.

## 6. Locking e concorrenza

Il locking applicativo deve essere trattato come una capability opzionale, utile per migliorare la UX collaborativa quando più utenti possono modificare contemporaneamente le stesse risorse, ma non come unico meccanismo di protezione dell’integrità dei dati [cite:117]. La soluzione architetturalmente più solida combina un lock applicativo a livello di dominio, con heartbeat e scadenza, a un optimistic version check sul salvataggio, che garantisce che eventuali race condition residue non possano causare overwrite silenziosi [cite:117].

Il contratto di lock deve essere esplicito e minimale: acquisizione del lock, heartbeat di rinnovo, rilascio volontario, rilascio forzato e save con version check [cite:117]. In configurazione locale, il lock può essere disattivato o sostituito da un adapter noop, mantenendo comunque il version check come rete di sicurezza; in configurazione collaborativa, il lock diventa parte integrante del flusso di editing e notifica in tempo reale [cite:117].

## 7. Modello persistente

Il modello persistente deve essere progettato per supportare una gerarchia di nodi con figli misti e una collezione di entity tipizzate, con campi comuni e campi specifici, persistendo le definizioni in una struttura relazionale e non in JSON/JSONB come storage principale dei dati business [cite:26][cite:36]. Le tabelle fondamentali devono includere `nodes` per la gerarchia, `node_types` e `node_type_fields` per la flessibilità tipologica dei nodi, `entities` come catalogo unificato delle foglie, e `entity_types`, `entity_type_fields`, `entity_type_field_constraints`, `entity_type_field_references` per la modellazione dinamica dei tipi entità [cite:26].

Per ogni tipo entità deve essere prevista una tabella dedicata `entity_<typeKey>`, con chiave primaria `entity_id` riferita a `entities.id`, contenente i campi specifici del tipo e indici appropriati, mentre `entities` conserva i campi comuni come nome, descrizione, nodo padre, metadati e stato [cite:26]. Il sistema deve includere anche tabelle per la gestione degli utenti, ruoli, permessi, assegnazioni e scope, oltre a strutture minime di audit e versioning, così da soddisfare i requisiti di tracciabilità e sicurezza senza appesantire il core del modello [cite:34][cite:26].

## 8. Service layer

Il service layer deve essere progettato per separare nettamente la logica di dominio e i casi d’uso dai dettagli di persistenza, infrastruttura e UI, esponendo use case chiari e orchestrazioni coerenti con i vincoli di dominio e le policy di sicurezza [cite:54]. I servizi applicativi devono dipendere da interfacce di repository e capability, non da implementazioni concrete di database o servizi esterni, in modo da rendere sostituibili gli adapter infrastrutturali senza modificare il dominio [cite:117].

I servizi principali devono includere autenticazione, gestione della gerarchia, gestione delle entity, gestione dei tipi, e amministrazione di utenti, ruoli e configurazioni [cite:34][cite:26]. Ogni use case deve seguire un flusso coerente: ricezione del comando, validazione input, verifica permessi e scope, applicazione regole di dominio, persistenza tramite repository, eventuale emissione di eventi di dominio, e restituzione di un risultato tipizzato e verificabile [cite:30].

## 9. Schema runtime registry

Il backend non deve conoscere a priori gli schemi delle entità: deve ricostruirli dinamicamente a runtime, leggendo dal database le definizioni dei tipi, i campi associati, i vincoli e i riferimenti, per poi compilarli in strutture eseguibili di validazione [cite:30]. Questo meccanismo è fondamentale per supportare la definizione amministrativa di nuovi tipi entità e campi senza dover ricompilare o ridistribuire il codice applicativo [cite:26].

Il registry degli schemi deve funzionare in modo simile a un compilatore JIT: all’avvio e a ogni modifica rilevante sui metadati dei tipi, il backend legge le definizioni aggiornate, costruisce schemi validanti, li memorizza in una cache in memoria e li utilizza per validare i payload in ingresso prima di applicare policy di dominio e persistenza [cite:30]. Il registry deve anche supportare versionamento e invalidazione controllata, in modo che cambiamenti sullo schema di un tipo non rompano silenziosamente le entità esistenti, ma vengano gestiti secondo regole esplicite di compatibilità e migrazione [cite:30][cite:26].

## 10. Frontend UI

La UI non deve essere definita come una schermata rigida con layout e componenti predecisi, ma come un sistema di presentazione composto da regioni e componenti applicativi configurabili a runtime [cite:54][cite:117]. Tree, breadcrumb, toolbar, pannello superiore alla lista, lista, dettaglio, sidebar contestuali e viste amministrative devono essere considerati elementi disponibili del sistema, non elementi obbligatori della composizione standard [cite:54].

La configurazione frontend deve poter decidere quali regioni della schermata sono attive, quali componenti vengono renderizzati in ciascuna regione, in quale ordine appaiono e quali dati o azioni espongono all’utente [cite:117]. In questo modello, anche un componente presente in una versione della UI ma assente in un’altra — come il blocco sopra la lista — resta una capability supportata dall’architettura e non una scelta eliminata dal sistema [cite:27].

Il tree rappresenta un caso particolare di questa stessa regola: la sua configurazione deve poter stabilire se mostra soltanto nodi, oppure nodi e alcune classi di entity, oppure anche foglie eterogenee, oltre a definire badge, contatori, azioni contestuali, criteri di espansione e metadati visibili per ciascun item [cite:36]. Lo stesso principio deve valere per lista, dettaglio, breadcrumb, toolbar e pannelli laterali, in modo che visibilità, grouping, filtri, campi mostrati e azioni disponibili non siano hardcoded ma governati da configurazione di sistema e policy di vista [cite:26][cite:34].

## 11. Frontend configuration model

Il frontend deve prevedere un configuration model esplicito, separato dalla logica di rendering, che descriva la composizione delle schermate, il comportamento dei componenti e le policy di presentazione applicate al contesto corrente [cite:54][cite:117]. Questo modello deve permettere di esprimere regioni UI opzionali, componenti attivabili o disattivabili, regole di visibilità, binding ai dati, ordering dei blocchi e dipendenze tra componenti, senza costringere a modificare il codice strutturale dell’interfaccia per ogni variazione funzionale [cite:54].

Ogni componente deve quindi essere pensato come una capability presentazionale con una propria configurazione: origine dati, campi visibili, modalità di raggruppamento, azioni esposte, eventi emessi e vincoli di permesso [cite:26][cite:34]. In questo modo il sistema può supportare più profili di interfaccia coerenti con la stessa architettura applicativa, lasciando aperta l’evoluzione del prodotto senza trasformare ogni scelta di layout o comportamento in un refactoring del frontend [cite:54][cite:27].

## 12. Frontend Read Model e Cache

Il frontend deve adottare un read model esplicito, in cui lo stato locale non è un semplice specchio passivo delle risposte API, ma una rappresentazione ottimizzata per rendering veloce, coerenza percepita e memoria controllata [cite:130]. Questo read model deve essere indipendente dalla composizione della schermata: poiché i componenti UI sono configurabili e possono variare tra profili diversi, lo strato dati non può essere costruito attorno a un tree, una lista o un dettaglio specifici, ma deve fornire un accesso generico e coerente alle stesse entità e nodi, indipendentemente da quale componente li stia consumando in un determinato momento [cite:54][cite:117].

Il modello dati client-side deve quindi essere diviso in almeno due strati logici: uno store normalizzato per entità e nodi, dove ogni oggetto è memorizzato per identità e condiviso da qualsiasi componente attivo, e una o più cache di navigazione page-based o view-based, che gestiscono solo gli insiemi ordinati di riferimenti necessari alla vista corrente, senza possedere i dati stessi [cite:99][cite:131]. Questa separazione garantisce che l’attivazione o disattivazione di un componente via configurazione non comporti riscrittura della logica di fetch o duplicazione dello stato, perché ogni componente si limita a dichiarare quali entità osservare e quale vista costruire sopra lo store condiviso [cite:100][cite:124].

La cache deve prevedere meccanismi espliciti di eviction, pin/unpin per elementi critici e invalidazione ben definita in risposta a eventi di dominio, cambi di filtro, cambio ordinamento, cambio nodo o cambio di configurazione dei componenti attivi, in modo da mantenere un footprint di memoria limitato e prevedibile anche durante scroll veloce e sessioni lunghe [cite:99].

## 13. Regole della lista paginata

La lista delle entity non deve essere intesa come una vista globale dell’intero sistema, ma come una vista contestuale: le entity che appartengono direttamente al nodo selezionato oppure a uno qualsiasi dei suoi discendenti, fino alle foglie, ordinabili secondo criteri configurabili e paginabili in modo efficiente [cite:35]. La semantica della lista deve essere esplicita: il backend riceve un contesto composto da nodo selezionato, filtri, ordinamento e pagina richiesta, e restituisce una pagina di risultati con metadati che indicano se esistono pagine precedenti e successive [cite:99].

Il frontend deve trattare la paginazione come un contratto chiaro: ogni pagina ha un indice, un insieme ordinato di riferimenti a entità e flag di continuità forniti dal backend; la cache conserva solo un numero limitato di pagine contigue, prefetched in modo opportunamente anticipato rispetto alla posizione corrente, e provvede a scaricare le pagine più lontane secondo una politica di eviction definita [cite:99]. Ogni cambio di contesto, come nodo, filtro o ordinamento, deve comportare il reset della cache e della viewport, in modo da evitare ambiguità di ordinamento e mantenere coerenza tra stato visibile e parametri di query [cite:51].

## 14. Access Control & Administration

Il sistema di accesso deve combinare ruoli, permessi e scope gerarchico, evitando sia un modello puramente role-based sia un modello puramente basato sull’albero [cite:34][cite:118]. I ruoli definiscono quali capability sono teoricamente disponibili a un utente, mentre le assegnazioni sui nodi determinano dove tali capability possono essere esercitate, così che un utente possa avere permessi ampi ma restare comunque confinato al proprio subtree operativo [cite:34].

Il sistema deve prevedere almeno una distinzione tra superAdmin, admin, moderator e user, ma senza cablare rigidamente tutte le operazioni nel nome del ruolo: anche il pannello amministrativo deve essere governato da permessi configurabili per pagina, sezione e azione [cite:118]. Il superAdmin rappresenta la radice fiduciaria del sistema e non deve poter essere eliminato; gli admin possono amministrare configurazione, utenti, ruoli, tipi e sistema; i moderator possono ricevere accesso a parti limitate del pannello e gestire solo utenti e risorse nel proprio scope; gli user operano principalmente sul proprio subtree secondo i permessi assegnati [cite:34][cite:118].

L’enforcement deve sempre avvenire server-side: la UI può nascondere funzioni non disponibili, ma la decisione effettiva su lettura, modifica, creazione, move, soft delete o accesso amministrativo deve essere presa dal backend sulla base di ruolo, permesso esplicito, nodo target e relazione gerarchica tra utente e risorsa [cite:34]. In particolare, i moderator e gli user assegnati devono poter creare, modificare e cancellare logicamente elementi nel proprio subtree, senza poter risalire oltre il nodo assegnato, mentre la vista UI deve mostrare soltanto i nodi realmente assegnati, senza esporre antenati fuori scope [cite:34].

## 15. Accessibilità

L’accessibilità non deve essere trattata come una rifinitura opzionale della UI, ma come una proprietà strutturale dell’interfaccia e dei suoi componenti configurabili [cite:57]. Poiché il frontend è composto da regioni e moduli attivabili o disattivabili via configurazione, ogni componente riusabile deve rispettare invarianti di accessibilità indipendentemente dal layout in cui viene montato [cite:57].

Questo implica almeno: navigazione da tastiera completa, focus visibile e coerente, uso corretto dei ruoli semantici HTML, etichette comprensibili per controlli e form, associazione esplicita tra label e input, gestione corretta di dialog e pannelli, e supporto a screen reader per tree, liste, bottoni icon-only e form dinamici [cite:57]. Anche i componenti virtualizzati e le viste gerarchiche devono essere progettati in modo che la semantica resti comprensibile e che le azioni fondamentali non dipendano esclusivamente da hover, colore o disposizione visiva [cite:57].

## 16. Validazione e hardening

La validazione deve essere applicata a più livelli e non delegata a un solo punto del sistema [cite:26][cite:51]. Il frontend può offrire validazione immediata per migliorare l’esperienza utente, ma il backend deve sempre rieseguire la validazione sintattica, strutturale e di dominio prima di accettare qualsiasi comando, soprattutto per entità e nodi definiti in modo dinamico tramite configurazione amministrativa [cite:30][cite:26].

La validazione runtime degli schemi deve essere costruita a partire dalle definizioni persistite dei tipi, compilata in strutture eseguibili e applicata prima delle policy e della persistenza, così da impedire che payload malformati, campi incoerenti o riferimenti invalidi entrino nel dominio [cite:30]. A questo si devono aggiungere misure di hardening architetturale coerenti con la Local Edition: sessioni server-side con cookie HttpOnly, enforcement server-side dei permessi, query e ordinamenti deterministici, invalidazione controllata della cache, gestione esplicita di errori di concorrenza e protezione dei confini tra layer per evitare che la UI o i repository assumano responsabilità che spettano ai servizi applicativi [cite:51][cite:57].

L’hardening deve comprendere anche la robustezza operativa: soft delete coerente, audit delle operazioni sensibili, protezioni sui ruoli fiduciari, controlli anti-ciclo nelle relazioni gerarchiche, version check sui salvataggi concorrenti, e disciplina rigorosa sugli adapter infrastrutturali, in modo che capability opzionali come lock, realtime o multi-user non introducano comportamenti impliciti o non verificabili nel core applicativo [cite:34][cite:117].

## 17. Vincoli e backlog evolutivo

L’architettura deve essere progettata per essere stabile nel core ma aperta nell’evoluzione, distinguendo chiaramente tra vincoli non negoziabili e capability rinviabili [cite:27][cite:54]. Sono vincoli fondativi: gerarchia a nodi con figli misti, entity tipizzate con definizioni amministrabili via UI, persistenza relazionale con tabelle dedicate per tipo, separazione a layer, enforcement server-side di permessi e scope, frontend configurabile e read model indipendente dalla composizione della schermata [cite:26][cite:36][cite:34].

Nel backlog evolutivo possono invece rientrare capability che l’architettura deve già prevedere ma non necessariamente attivare subito: realtime distribuito, locking avanzato, versioning più ricco, audit esteso, profili UI multipli più sofisticati, motori di policy più espressivi, automazioni, import/export strutturato, template di configurazione frontend e strumenti di migrazione amministrata degli schemi [cite:117][cite:54]. La regola deve essere che ogni estensione futura si innesti su contratti e astrazioni già presenti, senza richiedere la riscrittura del dominio centrale o del modello persistente [cite:27].
