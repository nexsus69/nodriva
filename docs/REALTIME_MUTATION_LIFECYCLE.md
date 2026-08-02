# Realtime mutation lifecycle

Le mutazioni persistono prima il dato e pubblicano l'evento realtime solo dopo
il completamento dell'operazione sul database. L'action attende la conclusione
della pubblicazione prima di restituire il risultato al client.

## Sequenze garantite

### Creazione

```text
create -> data:changed(created) -> response
```

### Aggiornamento

```text
lock (sessione di editing) -> update -> data:changed(updated) -> response -> unlock (UI)
```

Il lock non viene rilasciato automaticamente dall'update: può proteggere una
sessione di editing composta da più salvataggi. Il rilascio avviene quando la
sessione termina o il componente viene smontato.

### Spostamento

```text
lock (sessione di editing) -> move -> data:changed(moved) -> response -> unlock (UI)
```

L'evento include il nuovo contenitore e, quando disponibile, il contenitore
precedente, così le cache interessate possono aggiornare entrambe le viste.

### Cancellazione

```text
lock (eventuale) -> delete -> data:changed(deleted) -> unlock automatico -> response
```

Il rilascio automatico evita di lasciare un lock orfano su una risorsa ormai
inesistente. Se il rilascio fallisce, il TTL del lock resta il meccanismo di
fallback e l'operazione di cancellazione non viene annullata.

## Realtime disabilitato

Con `REALTIME_ENABLED=false` il bus server non inizializza Pusher e le action
continuano a eseguire normalmente le mutazioni. Con
`NEXT_PUBLIC_REALTIME_ENABLED=false` il client non apre sottoscrizioni e la
route di autorizzazione risponde con `503`.

La pubblicazione è comunque best-effort: in caso di errore vengono effettuati
tre tentativi, ma un problema di Pusher non rende fallita una mutazione già
salvata nel database.
