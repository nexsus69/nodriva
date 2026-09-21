# Stack Docker di riferimento

`docker-compose.full.yml` è un profilo di riferimento/test PostgreSQL per sviluppo e staging,
non un requisito dell'applicazione. Il file base avvia persistenza,
migrazioni/bootstrap, Web e proxy; le integrazioni distribuite sono overlay
Compose espliciti. La stessa configurazione runtime può puntare a servizi
remoti o gestiti dal provider. Il modello generale è descritto in
[`SERVICE_CONFIGURATION_ARCHITECTURE.md`](./SERVICE_CONFIGURATION_ARCHITECTURE.md).

Questo profilo include deliberatamente PostgreSQL e Caddy locali: non e'
l'esempio per collegare un PostgreSQL esterno e non deve essere usato come
prova che un deployment sia production-ready. Un PostgreSQL esterno e'
supportato dal runtime applicativo tramite `DATABASE_URL`, con migrazioni e
bootstrap gestiti dall'operatore fuori da questo file Compose. Lo standalone
SQLite si avvia con Node.js e non tramite l'immagine Web di questo profilo.

- `web`: Next.js production;
- `postgres`: PostgreSQL 17;
- `db-migrate`: schema base, migrazioni e ruolo applicativo ristretto;
- `soketi` e `realtime-worker` (`docker-compose.realtime.yml`): broker Pusher e drain autenticato
  dell’outbox realtime e dei workflow;
- `clamav` (`docker-compose.antivirus.yml`): scansione antivirus;
- `prometheus` (`docker-compose.monitoring.yml`): metriche;
- `backup` (`docker-compose.backup.yml`): backup PostgreSQL e restore verificato giornaliero;
- `proxy`: Caddy per Web e, con l'overlay realtime, WebSocket Soketi.

L'assenza di un overlay è intenzionale: Web non attende né avvia Soketi,
ClamAV, Prometheus o backup. Le capability corrispondenti risultano
`disabled` oppure `unavailable` nel catalogo servizi; non sono un errore di
bootstrap.

## Endpoint e porte

Nessun indirizzo o porta è incorporato nel profilo. Il deployment dichiara il
binding esterno e la topologia interna tramite le variabili elencate sotto.
PostgreSQL, ClamAV e i container interni non pubblicano endpoint esterni salvo
configurazione esplicita del rispettivo profilo.

## Configurazione

Creare un file `.env.docker` fuori dal repository o usare un secret manager.
Nel profilo base sono obbligatori solo i secret di PostgreSQL, autenticazione e
cifratura, oltre all'origine pubblica e ai parametri di ascolto del profilo
Compose:

```text
POSTGRES_PASSWORD=...
DASHBOARD_WEB_PASSWORD=...
NEXTAUTH_SECRET=...
ATTACHMENTS_ENCRYPTION_KEY=...
FIELD_ENCRYPTION_KEY=...
MFA_ENCRYPTION_KEY=...
DASHBOARD_PUBLIC_URL=https://dashboard.example.com
DASHBOARD_PUBLIC_HOST=dashboard.example.com
DASHBOARD_BIND_ADDRESS=...
DASHBOARD_WEB_BIND_ADDRESS=...
DASHBOARD_POSTGRES_PORT=...
DASHBOARD_POSTGRES_HOST=...
DASHBOARD_WEB_PORT=...
DASHBOARD_WEB_INTERNAL_HOST=...
DASHBOARD_WEB_INTERNAL_SCHEME=...
DASHBOARD_HTTP_PORT=...
DASHBOARD_HTTPS_PORT=...
CONTAINER_LOOPBACK_HOST=...
```

Nodriva non legge né richiede i nomi dei container Compose. Le variabili di
configurazione dell'applicazione descrivono un provider esterno o locale e sono
facoltative; i nomi `soketi` e `clamav` sono soltanto default interni del
profilo Compose corrispondente. Fuori Compose si avvia Nodriva direttamente
con le stesse variabili applicative, puntate a DNS, servizi gestiti o processi
locali scelti dal deployment.

I secret e gli endpoint delle integrazioni sono richiesti soltanto quando la
capability e il provider sono abilitati dal deployment:

| Profilo | Configurazione Compose locale | Equivalente remoto/non-Docker |
|---|---|---|
| `realtime` | `NEXT_PUBLIC_REALTIME_ENABLED=true`, chiave pubblica Pusher, `PUSHER_SECRET`, `REALTIME_WORKER_SECRET`, `REALTIME_INTERNAL_HOST`, `REALTIME_INTERNAL_PORT`, `REALTIME_INTERNAL_SCHEME` e host pubblico browser. Per usare il container locale: `REALTIME_INTERNAL_HOST=soketi`. | endpoint Pusher/Soketi gestito, worker come processo separato con gli stessi URL e secret |
| `antivirus` | `CLAMAV_HOST`, `CLAMAV_PORT`, `ATTACHMENTS_REQUIRE_SCAN=true` | daemon ClamAV remoto; senza daemon lasciare `CLAMAV_HOST` vuoto e la capability disabilitata |
| `monitoring` | `PROMETHEUS_ENDPOINT` solo se l'endpoint deve comparire nel catalogo servizi | Prometheus/collector gestito che effettua scrape del Web |
| `backup` | `BACKUP_ROOT=/backups/postgres`, `BACKUP_STATUS_FILE=/backups/postgres/last-status.json`, retention | job systemd/cron/orchestratore con storage protetto e manifest opzionalmente leggibile dal Web |

`DASHBOARD_PUBLIC_URL` è l'origine HTTPS canonica usata da autenticazione,
azioni account e healthcheck; `DASHBOARD_PUBLIC_HOST` è il solo hostname usato
da Caddy per il certificato. Devono descrivere lo stesso endpoint pubblico,
senza porta interna del container. `NEXT_PUBLIC_*` è pubblico e non deve contenere segreti; `PUSHER_SECRET` e il
secret del worker restano nel secret manager. Se il realtime è attivo, i valori
`NEXT_PUBLIC_*` sono usati durante la build dell’immagine Web: dopo una modifica
è necessario ricostruire `web`. Il riferimento dichiara esplicitamente
`DATABASE_ADAPTER=postgres`. `DASHBOARD_WEB_PASSWORD` può contenere caratteri
riservati nelle URL: l'entrypoint Web la codifica prima di costruire la URI di
PostgreSQL. Il realtime server-side è governato dalla
capability runtime `realtime`, mentre `NEXT_PUBLIC_REALTIME_ENABLED` controlla
solo la sottoscrizione del client.

`NEXT_PUBLIC_SESSION_IDLE_TIMEOUT_SECONDS` ha default `1800` (30 minuti) sia
come build arg sia nel runtime Web. Heartbeat, polling e TTL dei lock sono
derivati da questo unico valore; modificarlo richiede attualmente la
ricostruzione dell'immagine.

## Avvio

Profilo base, senza servizi opzionali:

```bash
docker compose --env-file .env.docker -f docker-compose.full.yml up -d --build
```

Profilo di riferimento/test con tutte le integrazioni di esempio:

```bash
docker compose --env-file .env.docker \
  -f docker-compose.full.yml \
  -f docker-compose.realtime.yml \
  -f docker-compose.antivirus.yml \
  -f docker-compose.monitoring.yml \
  -f docker-compose.backup.yml up -d --build
```

È possibile selezionare una sola integrazione, per esempio aggiungendo soltanto
`-f docker-compose.antivirus.yml`. Attivare un overlay senza la sua configurazione è
un errore di deployment, non un fallback implicito verso un container locale.

Il migrator termina con successo e il Web viene avviato solo dopo la sua
conclusione. Verificare:

```bash
docker compose --env-file .env.docker -f docker-compose.full.yml ps
curl https://dashboard.example.com/login
```

Il realtime client deve usare l'hostname pubblico configurato per Soketi. Nel
riferimento Caddy inoltra `/app/*` al container Soketi; fuori da Compose
l'inoltro è responsabilità del proxy o del provider realtime scelto.

## Volumi persistenti

- `dashboard_full_db_data`: database;
- `dashboard_full_attachments`: allegati;
- `dashboard_full_backups`: backup (`backup`); il mount Web in sola lettura non
  abilita il backup;
- `dashboard_full_clamav_db`: database firme antivirus (`antivirus`);
- `dashboard_full_prometheus`: metriche (`monitoring`);
- volumi Caddy: certificati e configurazione runtime.

Per replicare l’installazione su un’altra macchina occorre trasferire i
volumi dati, i secret e verificare un restore prima di avviare il Web.
Per impostazione predefinita anche applicazione, WebSocket e Prometheus sono
vincolati all'indirizzo dichiarato dal deployment.

Con `monitoring`, Prometheus conserva le serie per 30 giorni
(`PROMETHEUS_RETENTION_TIME`); il valore può essere modificato nel deployment.
Le regole realtime e workflow
sono valutate localmente; per consegnare notifiche è necessario collegare
Prometheus a un Alertmanager o a un sistema di alerting esterno approvato.
