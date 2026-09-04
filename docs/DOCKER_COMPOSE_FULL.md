# Stack Docker di riferimento

`docker-compose.full.yml` è un riferimento PostgreSQL per sviluppo e staging,
non un requisito dell'applicazione. Il profilo base avvia persistenza,
migrazioni/bootstrap, Web e proxy; le integrazioni distribuite sono profili
Compose espliciti. La stessa configurazione runtime può puntare a servizi
remoti o gestiti dal provider. Il modello generale è descritto in
[`SERVICE_CONFIGURATION_ARCHITECTURE.md`](./SERVICE_CONFIGURATION_ARCHITECTURE.md).

- `web`: Next.js production;
- `postgres`: PostgreSQL 17;
- `db-migrate`: schema base, migrazioni e ruolo applicativo ristretto;
- `soketi` e `realtime-worker` (`realtime`): broker Pusher e drain autenticato
  dell’outbox realtime e dei workflow;
- `clamav` (`antivirus`): scansione antivirus;
- `prometheus` (`monitoring`): metriche;
- `backup` (`backup`): backup PostgreSQL e restore verificato giornaliero;
- `proxy`: Caddy per Web e, con `realtime`, WebSocket Soketi.

L'assenza di un profilo è intenzionale: Web non attende né avvia Soketi,
ClamAV, Prometheus o backup. Le capability corrispondenti risultano
`disabled` oppure `unavailable` nel catalogo servizi; non sono un errore di
bootstrap.

## Porte

| Host | Destinazione | Uso |
|---:|---:|---|
| 80 | Caddy → Web | redirect/HTTP challenge |
| 443 | Caddy → Web e, con `realtime`, Soketi | HTTPS e WebSocket realtime |
| 9090 | Prometheus (`monitoring`) | metriche |

PostgreSQL, ClamAV e i container interni non pubblicano porte sull’host.

## Configurazione

Creare un file `.env.docker` fuori dal repository o usare un secret manager.
Nel profilo base sono obbligatori solo i secret di PostgreSQL, autenticazione e
cifratura:

```text
POSTGRES_PASSWORD=...
DASHBOARD_WEB_PASSWORD=...
NEXTAUTH_SECRET=...
ATTACHMENTS_ENCRYPTION_KEY=...
FIELD_ENCRYPTION_KEY=...
MFA_ENCRYPTION_KEY=...
DASHBOARD_PUBLIC_URL=https://dashboard.example.com
DASHBOARD_PUBLIC_HOST=dashboard.example.com
```

I secret e gli endpoint delle integrazioni sono richiesti soltanto quando la
capability e il provider sono abilitati dal deployment:

| Profilo | Configurazione Compose locale | Equivalente remoto/non-Docker |
|---|---|---|
| `realtime` | `NEXT_PUBLIC_REALTIME_ENABLED=true`, chiave pubblica Pusher, `PUSHER_SECRET`, `REALTIME_WORKER_SECRET`, `REALTIME_INTERNAL_HOST=soketi`, `REALTIME_INTERNAL_PORT=6001` e host pubblico browser | endpoint Pusher/Soketi gestito, worker come processo separato con gli stessi URL e secret |
| `antivirus` | `CLAMAV_HOST=clamav`, `CLAMAV_PORT=3310`, `ATTACHMENTS_REQUIRE_SCAN=true` | daemon ClamAV remoto; senza daemon lasciare `CLAMAV_HOST` vuoto e la capability disabilitata |
| `monitoring` | `PROMETHEUS_ENDPOINT` solo se l'endpoint deve comparire nel catalogo servizi | Prometheus/collector gestito che effettua scrape del Web |
| `backup` | `BACKUP_ROOT=/backups/postgres`, `BACKUP_STATUS_FILE=/backups/postgres/last-status.json`, retention | job systemd/cron/orchestratore con storage protetto e manifest opzionalmente leggibile dal Web |

`DASHBOARD_PUBLIC_URL` è l'origine HTTPS canonica usata da autenticazione,
azioni account e healthcheck; `DASHBOARD_PUBLIC_HOST` è il solo hostname usato
da Caddy per il certificato. Devono descrivere lo stesso endpoint pubblico,
senza porta interna del container. `NEXT_PUBLIC_*` è pubblico e non deve contenere segreti; `PUSHER_SECRET` e il
secret del worker restano nel secret manager. Se il realtime è attivo, i valori
`NEXT_PUBLIC_*` sono usati durante la build dell’immagine Web: dopo una modifica
è necessario ricostruire `web`. Il riferimento dichiara esplicitamente
`DATABASE_ADAPTER=postgres`. Il realtime server-side è governato dalla
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

Profilo completo di riferimento:

```bash
COMPOSE_PROFILES=realtime,antivirus,monitoring,backup \
  docker compose --env-file .env.docker -f docker-compose.full.yml up -d --build
```

È possibile selezionare una sola integrazione, per esempio
`COMPOSE_PROFILES=antivirus`. Attivare un profilo senza la sua configurazione è
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

## Avvio automatico al boot

Il template [`ops/systemd/nodriva.service`](../ops/systemd/nodriva.service)
avvia il profilo base dopo Docker e `network-online.target`. Per selezionare
integrazioni, aggiungere al file di deployment:

```text
NODRIVA_COMPOSE_PROFILES=realtime,antivirus,monitoring,backup
```

Prima di eseguire Compose attende l'indirizzo configurato in `DASHBOARD_BIND_ADDRESS`:
questo evita che il proxy fallisca il bind se la Wi-Fi ottiene l'IP dopo
l'avvio del demone Docker.

Installarlo sul server che usa il percorso del repository indicato nel
template:

```bash
sudo install -m 0644 ops/systemd/nodriva.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now nodriva.service
systemctl status nodriva.service
```

`web` e gli altri servizi persistenti selezionati usano inoltre
`restart: unless-stopped`. I job `db-migrate` e `db-seed` restano intenzionalmente
one-shot: il service Compose li esegue e attende prima di avviare Web.

Non usare `--remove-orphans` in questa unità: il secret manager Infisical è
gestito da un Compose distinto ma condivide il project name Docker.

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
vincolati a `127.0.0.1`.

Con `monitoring`, Prometheus conserva le serie per 30 giorni
(`PROMETHEUS_RETENTION_TIME`); il valore può essere modificato nel deployment.
Le regole realtime e workflow
sono valutate localmente; per consegnare notifiche è necessario collegare
Prometheus a un Alertmanager o a un sistema di alerting esterno approvato.
