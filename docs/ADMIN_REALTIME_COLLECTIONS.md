# Collection amministrative e realtime

## Contratto

Il realtime amministrativo trasporta un segnale di invalidazione autorizzato,
non dati da inserire direttamente nella tabella. Una collection attiva rilegge
sempre la propria proiezione dal backend.

Ogni risorsa amministrativa dichiara `realtimeDependencies` nel proprio
contratto di lista. Quando un evento realtime invalida una dipendenza
corrispondente, il lifecycle condiviso ricarica soltanto quella collection.

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
