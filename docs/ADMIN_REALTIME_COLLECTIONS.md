# Collection amministrative e realtime

## Contratto

Il realtime amministrativo trasporta un segnale di invalidazione autorizzato,
non dati da inserire direttamente nella tabella. Una collection attiva rilegge
sempre la propria proiezione dal backend.

Ogni risorsa amministrativa dichiara `realtimeDependencies` nel proprio
contratto di lista. Quando un evento realtime invalida una dipendenza
corrispondente, il lifecycle condiviso ricarica soltanto quella collection.

Una collection implementa il contratto attraverso il proprio hook/controller:

```ts
const REALTIME_DEPENDENCIES = ["audit"] as const;

useAdminRealtimeCollectionRefresh(
  REALTIME_DEPENDENCIES,
  () => loadCurrentData(),
);
```

`loadCurrentData` è la stessa lettura autorevole usata al primo caricamento e
dal refresh manuale: conserva filtri, ordinamento e pagina correnti. Il
componente non pubblica eventi realtime e non interpreta payload di dominio;
dichiara soltanto le collection semantiche da cui dipende. Se una nuova
risorsa non è ancora tradotta in una chiave di collection, il mapping viene
aggiunto una sola volta nel `GlobalCacheClient`, con test di autorizzazione e
invalidazione, prima di usare la dipendenza nel componente.

## Finestre paginate e ancoraggio

Una collection amministrativa potenzialmente non limitata — dati creati dagli
utenti, risorse operative, utenti, assegnazioni, cestino, audit o workflow —
usa paginazione remota. Il backend possiede scope, filtri, ordinamento, cursore
o offset e conteggio necessario alla navigazione; il browser richiede soltanto
la finestra selezionata. Non è ammesso percorrere tutte le pagine backend per
costruire una lista locale e applicare poi la paginazione visiva.

La cache può trattenere un numero esplicitamente limitato di finestre già
visitate, identificate dalla query autorevole e dalla pagina o cursore. Non può
fondere tali finestre in un dataset completo nel controller della collection.
La meccanica comune (`PagedWindowCoordinator`) possiede soltanto LRU, indice
risorsa→finestra, deduplicazione delle richieste e scarto delle risposte di una
generazione precedente. Ogni catalogo conserva invece nel proprio coordinator
la normalizzazione della query, il read-port autorizzato, la proiezione nel
cache kernel e la propria policy di impatto realtime: la primitiva non decide
mai autorizzazione, filtri o contenuto della cache.
Cataloghi semanticamente finiti e di piccola cardinalità possono mantenere la
paginazione client soltanto quando il loro owner documenta tale limite.

Dopo un cambio pagina, il controllo di paginazione attivato resta visibile e
riceve il focus. La variazione dell'altezza, inclusa l'ultima pagina più corta,
non può spostare il menu fuori dal viewport né lasciare il focus su un elemento
rimosso. Il controller mantiene query, pagina e selezione compatibile; il
componente condiviso possiede l'ancoraggio e non ogni screen separatamente.

Testare: prima pagina senza caricamento integrale, navigazione avanti/indietro,
ultima pagina incompleta, ritenzione ed espulsione della cache, modifica di
filtri o ordinamento, refresh realtime della stessa query e parità
SQLite/PostgreSQL.

## Capability realtime disattivata

Realtime è una capability opzionale. Quando è deliberatamente disattivata
(come può accadere nel profilo SQLite standalone), la collection continua a
funzionare nella generazione cache `disabled`: prima di un accesso logico
significativo carica dal backend la finestra richiesta. Non deve mostrare un
errore, aprire canali, invocare endpoint di autenticazione realtime o trattare
l'assenza di invalidazioni come un guasto.

Il comportamento cambia soltanto nella tempestività dell'aggiornamento; non
nel risultato della lettura, nei filtri, nell'autorizzazione o nella
concorrenza. Testare esplicitamente sia il percorso con invalidazione ricevuta
sia quello con capability disattivata e ricaricamento autorevole della finestra.

## Garanzie di interazione

- filtri, ordinamento e pagina correnti sono mantenuti durante il reload;
- le righe precedenti restano visibili fino alla risposta autorevole;
- eventi ravvicinati sono accorpati;
- una risposta precedente non può sovrascrivere un reload più recente;
- in background la collection viene marcata obsoleta e si riallinea al ritorno;
- una lista non sovrascrive form, drawer o bozze: i dettagli mantengono il
  proprio contratto di lock e `rowVersion`.

L’autorizzazione resta nel backend e nel routing Pusher: il browser reagisce
solo a eventi già consegnati su canali autorizzati e non ricava visibilità dal
payload realtime.

Le mutation amministrative non dipendono da una seconda transazione per la
notifica. Il `PolicyAuditRecorder` persiste audit e invalidazioni delle
collection amministrative nella stessa outbox transazionale; il worker le
pubblica soltanto dopo il commit. Una consegna duplicata è ammessa e viene
coalescata dal lifecycle, mentre la perdita del segnale autorevole non lo è.
