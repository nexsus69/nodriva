# Guida di installazione

Questa guida installa Nodriva senza assumere Docker, un cloud provider o un
orchestratore specifico. Docker Compose è un profilo di riferimento opzionale:
non è un requisito dell'applicazione.

## 1. Scegliere il profilo

| Profilo | Quando usarlo | Requisiti obbligatori |
| --- | --- | --- |
| SQLite standalone | singola istanza locale o piccolo ambiente autonomo | Node.js, file SQLite persistente, filesystem allegati persistente |
| PostgreSQL | installazione completa o distribuita | Node.js, PostgreSQL amministrato, ruolo applicativo ristretto, storage allegati |
| Compose di riferimento | sviluppo, demo o verifica replicabile | Docker e configurazione `.env.docker` |

SQLite e PostgreSQL condividono il comportamento applicativo. Realtime,
antivirus, backup schedulato, metriche e delivery delle azioni account sono
integrazioni opzionali: abilitarle solo quando il relativo deployment è stato
configurato e verificato.

## 2. Prerequisiti comuni

- Node.js 24 e Corepack;
- una directory persistente, non pubblica, per dati e allegati;
- un URL pubblico HTTPS per un deployment accessibile agli utenti;
- secret diversi per ogni ambiente e mai salvati nel repository.

Installare le dipendenze dalla root del repository:

```bash
corepack enable
pnpm install --frozen-lockfile
```

Copiare `.env.example` in un file protetto esterno al repository (per esempio
`/etc/nodriva/nodriva.env`), sostituire ogni placeholder e limitare i permessi
al solo account che avvia il processo.

Le variabili comuni richieste sono:

```text
NEXTAUTH_URL=https://nodriva.example.test
NEXTAUTH_SECRET=<almeno 32 caratteri casuali>
SEED_ADMIN_EMAIL=admin@example.test
SEED_ADMIN_PASSWORD=<password iniziale forte>
ATTACHMENTS_ROOT=/srv/nodriva/attachments
ATTACHMENTS_ENCRYPTION_KEY=<64 caratteri esadecimali casuali>
FIELD_ENCRYPTION_KEY=<64 caratteri esadecimali casuali>
MFA_ENCRYPTION_KEY=<32 byte casuali codificati base64>
```

Il bootstrap dell'amministratore è additivo e idempotente: non cancella dati
esistenti. Le chiavi di cifratura devono essere salvate e sottoposte a backup
insieme ai dati; perderle rende irrecuperabili i valori cifrati.

### Riferimento completo delle variabili applicative

Queste sono le variabili lette dal processo Web. L'orchestratore può aggiungere
porte, hostname, logging e limiti di risorsa propri: non fanno parte del
contratto applicativo Nodriva.

| Gruppo | Variabili | Necessarie quando | Note |
| --- | --- | --- | --- |
| Avvio e autenticazione | `NEXTAUTH_URL`, `NEXTAUTH_SECRET`, `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD` | sempre | l'URL deve essere l'origine pubblica canonica; il seed è idempotente |
| SQLite | `DATABASE_ADAPTER=sqlite`, `SQLITE_DATABASE_PATH` | profilo standalone | il percorso deve stare su storage persistente |
| PostgreSQL | `DATABASE_ADAPTER=postgres`, `DATABASE_URL`, `REQUIRE_RESTRICTED_DB_ROLE=true` | profilo PostgreSQL | il login nell'URL deve appartenere a `dashboard_app`, non essere superuser |
| Allegati | `ATTACHMENTS_ROOT`, `ATTACHMENTS_REQUIRE_ENCRYPTION` | sempre se si usano allegati | filesystem persistente, non pubblico |
| Cifratura | `FIELD_ENCRYPTION_KEY`, `ATTACHMENTS_ENCRYPTION_KEY`, `MFA_ENCRYPTION_KEY` | sempre nel profilo corrente | le varianti `*_KEYS` e `*_ACTIVE_VERSION` servono alla rotazione; vedi `ENCRYPTION_ROTATION.md` |
| Realtime | `NEXT_PUBLIC_REALTIME_ENABLED`, `NEXT_PUBLIC_PUSHER_KEY`, `NEXT_PUBLIC_PUSHER_CLUSTER`, `NEXT_PUBLIC_PUSHER_HOST`, `NEXT_PUBLIC_PUSHER_PORT`, `NEXT_PUBLIC_PUSHER_SCHEME`, `PUSHER_APP_ID`, `PUSHER_SECRET`, `REALTIME_INTERNAL_HOST`, `REALTIME_INTERNAL_PORT`, `REALTIME_INTERNAL_SCHEME`, `REALTIME_WORKER_SECRET` | realtime abilitato | i valori `NEXT_PUBLIC_*` sono incorporati nella build Web; ricostruire dopo una modifica |
| Antivirus | `CLAMAV_HOST`, `CLAMAV_PORT`, `CLAMAV_TIMEOUT_MS`, `ATTACHMENTS_REQUIRE_SCAN` | scansione allegati abilitata | l'assenza di `CLAMAV_HOST` disabilita il provider |
| Azioni account | `ACCOUNT_ACTION_DELIVERY_WEBHOOK_URL`, `ACCOUNT_ACTION_DELIVERY_WEBHOOK_SECRET`, `ACCOUNT_ACTION_DELIVERY_TIMEOUT_MS`, `ACCOUNT_ACTION_PUBLIC_BASE_URL` | inviti, recupero password o delivery esterna abilitati | l'URL pubblico può coincidere con `NEXTAUTH_URL` |
| Backup | `BACKUP_ROOT`, `BACKUP_STATUS_FILE` | evidenza backup nella UI | il Web deve poter leggere il manifest, non il contenuto del backup |
| Osservabilità | `PROMETHEUS_ENDPOINT` | endpoint da esporre nel catalogo amministrativo | il collector può essere locale o remoto |

Le chiavi di rotazione supportate sono `FIELD_ENCRYPTION_KEYS`,
`FIELD_ENCRYPTION_ACTIVE_VERSION`, `ATTACHMENTS_ENCRYPTION_KEYS`,
`ATTACHMENTS_ENCRYPTION_ACTIVE_VERSION`, `ACCOUNT_ACTION_ENCRYPTION_KEY`,
`ACCOUNT_ACTION_ENCRYPTION_KEYS` e `ACCOUNT_ACTION_ENCRYPTION_ACTIVE_VERSION`.
Sono secret di deployment e non devono apparire nel pannello, nel repository o
nei log. Il catalogo normativo completo è in
[RUNTIME_CONFIGURATION_CATALOG.md](RUNTIME_CONFIGURATION_CATALOG.md).

## 3. SQLite standalone

Impostare nel file d'ambiente:

```text
DATABASE_ADAPTER=sqlite
SQLITE_DATABASE_PATH=/srv/nodriva/data/nodriva.sqlite
```

Creare le directory persistenti con permessi riservati al processo Web:

```bash
install -d -m 0700 /srv/nodriva/data /srv/nodriva/attachments
```

Avviare il Web con l'ambiente selezionato. L'esempio usa una shell POSIX; un
service manager, Kubernetes o altro orchestratore deve passare le stesse
variabili senza scriverle nei log.

```bash
set -a
. /etc/nodriva/nodriva.env
set +a
pnpm --filter @dashboard/web build
pnpm --filter @dashboard/web start
```

Al primo avvio Nodriva crea lo schema SQLite e il bootstrap amministrativo.
Realtime e antivirus restano normalmente disabilitati in questo profilo.

## 4. PostgreSQL esterno

Creare un database vuoto e un'identità amministrativa temporanea, separata
dall'identità usata dall'applicazione. Il database deve supportare le estensioni
`pgcrypto` e `ltree`.

Inizializzare lo schema base e applicare tutte le migrazioni in ordine
lessicografico usando esclusivamente l'identità amministrativa. Esempio:

```bash
psql "$NODRIVA_POSTGRES_ADMIN_URL" -v ON_ERROR_STOP=1 \
  -f Specifiche/dashboard_v4_schema_corrected.sql
for migration in db/migrations/*.sql; do
  psql "$NODRIVA_POSTGRES_ADMIN_URL" -v ON_ERROR_STOP=1 -f "$migration"
done
```

Seguire [db/README.md](../db/README.md) per il ruolo `dashboard_app`, il login
dedicato e i vincoli del ruolo ristretto. Il processo Web non deve mai usare
`postgres`, un superuser o un'identità con privilegi DDL generici.

Impostare poi:

```text
DATABASE_ADAPTER=postgres
DATABASE_URL=postgresql://dashboard_web:<secret>@db.example.test:5432/nodriva?sslmode=require
REQUIRE_RESTRICTED_DB_ROLE=true
```

Costruire e avviare il Web con gli stessi comandi del profilo SQLite. Le
migrazioni e il bootstrap devono terminare prima che il Web accetti traffico.

## 5. Integrazioni opzionali

Un servizio in esecuzione non abilita automaticamente una capability:
l'integrazione deve essere dichiarata esplicitamente al processo Web.

| Funzione | Configurazione minima del Web | Comportamento senza configurazione |
| --- | --- | --- |
| Realtime | `NEXT_PUBLIC_REALTIME_ENABLED=true`, parametri Pusher/Soketi e secret worker | disabilitato |
| Antivirus | `CLAMAV_HOST`, `CLAMAV_PORT`, `ATTACHMENTS_REQUIRE_SCAN=true` | disabilitato |
| Consegna azioni account | `ACCOUNT_ACTION_DELIVERY_WEBHOOK_URL` e, se necessario, relativo secret | disabilitata |
| Metriche/observability | `PROMETHEUS_ENDPOINT` | non configurata nel catalogo amministrativo |
| Evidenza backup nella UI | `BACKUP_ROOT` e `BACKUP_STATUS_FILE` leggibile dal Web | “Stato non disponibile” |

Per il backup, il processo che genera dump/snapshot può essere systemd, cron,
Kubernetes, un provider gestito o Compose. Per mostrare l'esito in Nodriva deve
scrivere un manifest compatibile `last-status.json` e rendere quel solo file
leggibile dal Web. Il Web non crea, modifica né espone il backup. Consultare
[BACKUP_OPERATIONS.md](BACKUP_OPERATIONS.md) e [BACKUP_RESTORE.md](BACKUP_RESTORE.md).

## 6. Verifica dopo l'installazione

Prima di esporre l'istanza agli utenti:

```bash
pnpm --filter @dashboard/web typecheck
pnpm --filter @dashboard/web lint
pnpm --filter @dashboard/web test
pnpm --filter @dashboard/web build
```

Verificare inoltre l'healthcheck HTTP, il login dell'amministratore iniziale,
la scrittura in una directory allegati persistente e, se configurate, tutte le
integrazioni. La checklist completa è in
[OPERATIONS_READINESS.md](OPERATIONS_READINESS.md).

## 7. Compose come esempio opzionale

Il profilo PostgreSQL di riferimento è descritto in
[DOCKER_COMPOSE_FULL.md](DOCKER_COMPOSE_FULL.md). Usarlo solo dopo avere
compilato una `.env.docker` protetta; scegliere esplicitamente gli overlay
realtime, antivirus, monitoring e backup che servono al deployment.

## Riferimenti

- [Modello di deployment](DEPLOYMENT_MODEL.md)
- [Catalogo configurazioni runtime e deployment](RUNTIME_CONFIGURATION_CATALOG.md)
- [Sicurezza operativa](SECURITY_OPERATIONS.md)
- [Backup e restore](BACKUP_RESTORE.md)
