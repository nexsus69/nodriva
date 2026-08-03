# Realtime mutation lifecycle

Le mutazioni persistono prima il dato e pubblicano l'evento realtime solo dopo
il completamento dell'operazione sul database. L'action attende la conclusione
della pubblicazione prima di restituire il risultato al client.

Gli eventi dati viaggiano su canali di policy condivisi:

```text
private-realtime-policy-{policyHash}-data
```

Il server risolve il nodo padre e tutti gli antenati, applica allow/deny e
pubblica su ogni policy che include la risorsa. In caso di spostamento vengono
considerati anche gli antenati della posizione precedente. Il frontend lascia
alla cache la decisione di aggiornare l'entità, invalidare una vista o ignorare
un evento già superato dal `rowVersion`.

I canali lock restano separati dai dati: hanno frequenza, ciclo di vita e
semantica di errore diversi dagli eventi dati.

## Canali policy condivisi

Il canale realtime non viene costruito dal client e non rappresenta soltanto un
nodo. Il server calcola la policy ACL effettiva (allow meno deny), la normalizza
e la identifica con un hash. Utenti con la stessa policy condividono lo stesso
canale:

```text
private-realtime-policy-{policyHash}-data
private-realtime-policy-{policyHash}-locks
```

Il client riceve i nomi dei canali da una Server Action e può sottoscrivere
soltanto quelli. Il router server-side valuta ogni evento contro tutte le
policy e pubblica l'evento solo sui canali autorizzati. Un evento sotto `NodeC`
viene quindi inviato alla policy `NodeA subtree allow`, ma non alla policy
`NodeA subtree allow + NodeC subtree deny`.

La route di autorizzazione Pusher verifica nuovamente il canale contro la
policy corrente dell'utente. Il transport Pusher è isolato in un adapter
dedicato e diventa un no-op quando il realtime è disabilitato.

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

La risoluzione degli antenati usa il repository PostgreSQL e `ltree`. Se la
risoluzione fallisce, viene registrato l'errore e si tenta la pubblicazione sullo
scope diretto disponibile; se anche la pubblicazione realtime fallisce, la
mutazione già committata non viene annullata.
