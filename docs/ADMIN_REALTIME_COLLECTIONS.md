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

## Capability realtime disattivata

Realtime è una capability opzionale. Quando è deliberatamente disattivata
(come può accadere nel profilo SQLite standalone), la collection continua a
leggere e aggiornare i dati tramite il proprio caricamento autorevole e il
refresh manuale. Non deve mostrare un errore, aprire canali, invocare endpoint
di autenticazione realtime o trattare l'assenza di invalidazioni come un
guasto.

Il comportamento cambia soltanto nella tempestività dell'aggiornamento; non
nel risultato della lettura, nei filtri, nell'autorizzazione o nella
concorrenza. Testare esplicitamente sia il percorso con invalidazione ricevuta
sia quello con capability disattivata.

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
