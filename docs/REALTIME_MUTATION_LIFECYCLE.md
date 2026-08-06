# Realtime mutation lifecycle

Le mutazioni Node/Entity persistono il dato e il relativo evento nella stessa
transazione PostgreSQL. Dopo il commit l'action avvia un drain best-effort
dell'outbox; la risposta non dipende dalla disponibilità di Pusher.

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
policy corrente dell'utente. La connessione Pusher è inoltre autenticata con
l'utente applicativo: una variazione di scope, ruolo o stato utente invalida la
cache dopo il commit e termina le connessioni dell'utente, imponendo una nuova
autorizzazione delle sottoscrizioni. Il client riconcilia canali e virtual root
con l'intervallo derivato dalla durata di sessione (attualmente 50 secondi) come
rete di sicurezza per provider compatibili senza terminazione utenti. Questa
riconciliazione è passiva e non rinnova la sessione.

## Sequenze garantite

### Creazione

```text
create -> data:changed(created) -> response
```

### Aggiornamento

```text
lock (sessione autenticata) -> update -> data:changed(updated) -> response -> unlock (UI)
```

Il lock non viene rilasciato automaticamente dall'update: può proteggere una
modalità di modifica composta da più salvataggi. Appartiene alla specifica
sessione autenticata, non genericamente all'utente, e viene rinnovato soltanto
da attività umana della medesima sessione. Il rilascio avviene uscendo dalla
modalità di modifica, smontando il componente o effettuando il logout; TTL e
cascata sulla sessione restano garanzie server-side.

### Spostamento

```text
lock (sessione autenticata) -> move -> data:changed(moved) -> response -> unlock (UI)
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

Il contratto completo di attività, timeout e proprietà dei lock è descritto in
[`HUMAN_ACTIVITY_SESSION_LOCKS.md`](./HUMAN_ACTIVITY_SESSION_LOCKS.md).

## Realtime disabilitato

Con `REALTIME_ENABLED=false` il bus server non inizializza Pusher e le action
continuano a eseguire normalmente le mutazioni. Con
`NEXT_PUBLIC_REALTIME_ENABLED=false` il client non apre sottoscrizioni e la
route di autorizzazione risponde con `503`.

La pubblicazione è at-least-once tramite `realtime_event_outbox`. Ogni worker
reclama righe con un lease PostgreSQL (`FOR UPDATE SKIP LOCKED`); i fallimenti
usano backoff esponenziale e non rendono fallita una mutazione già salvata. Un
job autenticato deve richiamare `POST /api/internal/realtime/drain` con
`Authorization: Bearer $REALTIME_WORKER_SECRET` per svuotare l'outbox anche in
assenza di nuove mutazioni.

Nel deployment Docker fornito dal repository, `realtime-worker` effettua tale
chiamata ogni cinque secondi. Impostare lo stesso `REALTIME_WORKER_SECRET` nel
processo Web e nel Compose. Il worker appartiene al profilo opzionale
`realtime`, quindi avviarlo con `docker compose --profile realtime up -d --build
realtime-worker` solo dopo che il processo Web è raggiungibile. Per sviluppo con Web sull'host, l'URL predefinito usa
`host.docker.internal:3000`; in un deployment con Web containerizzato impostare
`REALTIME_DRAIN_URL` al nome DNS interno del servizio Web.

La risoluzione degli antenati usa il repository PostgreSQL e `ltree`. Se fallisce,
viene registrato l'errore e l'evento mantiene soltanto lo scope diretto: è una
scelta conservativa che evita di ampliare la visibilità. Il dato resta corretto;
il worker ritenta la consegna, senza ricalcolare uno scope potenzialmente più
ampio.

## Operatività

`GET /api/internal/realtime/metrics` espone metriche Prometheus protette dallo
stesso segreto del worker. Le metriche sono locali al processo: in un deployment
multiistanza devono essere raccolte da ogni replica.

Prometheus è opzionale ed è nel profilo Compose `monitoring`: avviarlo con
`docker compose --profile monitoring up -d prometheus`. Valuta alert su età
del backlog, retry, tentativi ripetuti e fallimenti di publish. Per ciascuna
replica Web aggiungere un target al job `dashboard-web-realtime` (oppure
eseguire una replica Prometheus per rete/host); l'endpoint resta protetto da
`REALTIME_WORKER_SECRET`.
