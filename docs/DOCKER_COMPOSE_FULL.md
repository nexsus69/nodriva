# Stack Docker completo

`docker-compose.full.yml` descrive l’installazione replicabile con tutte le
funzionalità del progetto:

- `web`: Next.js production;
- `postgres`: PostgreSQL 17;
- `db-migrate`: schema base, migrazioni e ruolo applicativo ristretto;
- `soketi`: broker Pusher realtime;
- `realtime-worker`: drain dell’outbox;
- `clamav`: scansione antivirus;
- `prometheus`: metriche;
- `backup`: backup e restore verificato giornaliero;
- `proxy`: Caddy per Web e WebSocket Soketi.

## Porte

| Host | Destinazione | Uso |
|---:|---:|---|
| 3001 | Caddy → Web | applicazione |
| 6001 | Caddy → Soketi | WebSocket realtime |
| 9090 | Prometheus | metriche |

PostgreSQL, ClamAV e i container interni non pubblicano porte sull’host.

## Configurazione

Creare un file `.env.docker` fuori dal repository o usare un secret manager.
Sono obbligatori almeno:

```text
POSTGRES_PASSWORD=...
DASHBOARD_WEB_PASSWORD=...
NEXTAUTH_SECRET=...
NEXT_PUBLIC_PUSHER_KEY=...
PUSHER_SECRET=...
REALTIME_WORKER_SECRET=...
ATTACHMENTS_ENCRYPTION_KEY=...
FIELD_ENCRYPTION_KEY=...
MFA_ENCRYPTION_KEY=...
```

Le variabili `NEXT_PUBLIC_*` sono usate durante la build dell’immagine Web;
dopo una modifica è necessario ricostruire `web`.

## Avvio completo

```bash
docker compose --env-file .env.docker -f docker-compose.full.yml up -d --build
```

Il migrator termina con successo e il Web viene avviato solo dopo la sua
conclusione. Verificare:

```bash
docker compose --env-file .env.docker -f docker-compose.full.yml ps
curl http://localhost:3001/login
```

Il realtime client deve usare `localhost:6001` (o l’hostname pubblico) per
Soketi. Caddy inoltra anche l’upgrade WebSocket.

## Volumi persistenti

- `dashboard_full_db_data`: database;
- `dashboard_full_attachments`: allegati;
- `dashboard_full_backups`: backup;
- `dashboard_full_clamav_db`: database firme antivirus;
- `dashboard_full_prometheus`: metriche;
- volumi Caddy: certificati e configurazione runtime.

Per replicare l’installazione su un’altra macchina occorre trasferire i
volumi dati, i secret e verificare un restore prima di avviare il Web.
