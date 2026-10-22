# Guida di installazione

Questa guida installa Nodriva senza assumere Docker, un cloud provider o un
orchestratore specifico. Docker Compose è un profilo di riferimento opzionale:
non è un requisito dell'applicazione.

Percorso: prerequisiti → un solo profilo database → build e avvio → verifica
→ [primo utilizzo](FIRST_RUN.md). Per requisiti del processo, aggiornamenti e
diagnostica vedere il [runbook Node.js](NODE_OPERATIONS.md). Gli esempi shell
partono dalla root del repository, salvo indicazione diversa; non sono reset.

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

### Cosa contiene una nuova installazione

Su un database nuovo vengono creati schema, amministratore iniziale, ruoli,
permessi, impostazioni e cataloghi tecnici. **Non vengono creati nodi, entità,
allegati o tipi applicativi demo.** I tipi e i contenuti si configurano dopo il
primo accesso. Lo stesso vale per entrambi gli adapter.

Riutilizzare un file SQLite, un database PostgreSQL o un volume Docker esistente
conserva i dati: reinstallazione e bootstrap non svuotano l'ambiente. Per una
seconda installazione pulita predisporre storage e database separati; non
eliminare quelli correnti. Le fixture E2E non sono un installer e non devono
essere eseguite contro dati operativi.

## 2. Prerequisiti comuni

- Node.js 24 e Corepack;
- una directory persistente, non pubblica, per dati e allegati;
- un URL pubblico HTTPS per un deployment accessibile agli utenti;
- secret diversi per ogni ambiente e mai salvati nel repository.

Partire da un checkout della release scelta, annotandone il commit. La versione
pnpm è fissata da `packageManager` nel `package.json`: usare quella versione,
non aggiornare il lockfile durante l'installazione. Per PostgreSQL gli esempi
sono verificati sul profilo PostgreSQL 17; servono anche i client `psql`,
`pg_dump` e `pg_restore` compatibili con il server.

Installare le dipendenze dalla root del repository:

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm --filter @dashboard/core build
```

Copiare `.env.example` in un file protetto esterno al repository (per esempio
`/etc/nodriva/nodriva.env`), sostituire ogni placeholder e limitare i permessi
al solo account che avvia il processo.

Se viene caricato con `.`, il file deve essere compatibile con la shell:
quotare i valori contenenti caratteri speciali. Non usare `set -x` né stampare
l'ambiente nei log. Il file copiato è un modello, non una configurazione pronta.
Usare percorsi **assoluti** per dati e allegati: la directory di lavoro cambia
tra CLI, server standalone e service manager.

Le variabili comuni richieste sono:

```text
NEXTAUTH_URL=https://nodriva.example.test
NEXTAUTH_SECRET=<almeno 32 caratteri casuali>
SEED_ADMIN_EMAIL=admin@example.test
SEED_ADMIN_PASSWORD=<password iniziale forte>
ATTACHMENTS_ROOT=/srv/nodriva/attachments
ATTACHMENTS_REQUIRE_ENCRYPTION=true
ATTACHMENTS_ENCRYPTION_KEY=<64 caratteri esadecimali casuali>
FIELD_ENCRYPTION_KEY=<64 caratteri esadecimali casuali>
MFA_ENCRYPTION_KEY=<32 byte casuali codificati base64>
NEXT_PUBLIC_REALTIME_ENABLED=false
ATTACHMENTS_REQUIRE_SCAN=false
```

Il bootstrap dell'amministratore è additivo e idempotente: non cancella dati
esistenti. Le chiavi di cifratura devono essere salvate e sottoposte a backup
insieme ai dati; perderle rende irrecuperabili i valori cifrati.

Generare valori indipendenti con `openssl rand -hex 32` (secret auth e chiavi
hex) oppure `openssl rand -base64 32` (MFA), in un terminale riservato senza
registrazione dell'output. Trasferirli nel secret manager/file protetto. Non
rigenerarli a ogni riavvio; conservare le versioni necessarie ai backup,
separatamente dagli archivi cifrati.

Per una prova locale usare `NEXTAUTH_URL=http://127.0.0.1:3000` e bind loopback.
Per accesso remoto predisporre DNS, certificato e proxy HTTPS prima di esporre
il servizio. Adattare sempre gli hostname di esempio.

### Principali variabili applicative

Queste sono le variabili lette dal processo Web. L'orchestratore può aggiungere
porte, hostname, logging e limiti di risorsa propri: non fanno parte del
contratto applicativo Nodriva.

| Gruppo | Variabili | Necessarie quando | Note |
| --- | --- | --- | --- |
| Avvio e autenticazione | `NEXTAUTH_URL`, `NEXTAUTH_SECRET`; `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD` per bootstrap | autenticazione; identità iniziale durante bootstrap | il seed non reimposta la password di un utente esistente |
| Sessione | `NEXT_PUBLIC_SESSION_IDLE_TIMEOUT_SECONDS` | opzionale, default 1800 secondi | policy temporale condivisa; una modifica richiede rebuild |
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

Le directory dei dati e degli allegati devono esistere, essere persistenti e
scrivibili dal processo Web, senza accesso pubblico. La loro predisposizione
e la configurazione degli account del sistema operativo spettano al deployment.

Avviare il Web con l'ambiente selezionato. L'esempio usa una shell POSIX; un
service manager, Kubernetes o altro orchestratore deve passare le stesse
variabili senza scriverle nei log.

```bash
set -eu
set -a
. /etc/nodriva/nodriva.env
set +a
pnpm --filter @dashboard/core build
pnpm --filter @dashboard/web build
mkdir -p packages/web/.next/standalone/packages/web/.next/static
mkdir -p packages/web/.next/standalone/packages/web/public
cp -a packages/web/.next/static/. packages/web/.next/standalone/packages/web/.next/static/
cp -a packages/web/public/. packages/web/.next/standalone/packages/web/public/
HOSTNAME=127.0.0.1 PORT=3000 node packages/web/.next/standalone/packages/web/server.js
```

Al primo avvio Nodriva crea lo schema SQLite e il bootstrap amministrativo.
Realtime e antivirus restano normalmente disabilitati in questo profilo.

Eseguire build e avvio come account autorizzato, non come root. Il repository
usa `output: 'standalone'`: il server generato è il percorso production qui
documentato; copiare anche asset statici e `public`, come fa l'immagine Docker.
Il comando resta in primo piano; la gestione del processo spetta al deployment.
I requisiti applicativi sono in [NODE_OPERATIONS.md](NODE_OPERATIONS.md).
La build carica moduli server: usare
solo l'ambiente scelto e non un file SQLite operativo per una build di prova.

## 4. PostgreSQL esterno

Creare un database vuoto e un'identità amministrativa temporanea, separata
dall'identità usata dall'applicazione. Il database deve supportare le estensioni
`pgcrypto` e `ltree`.

Inizializzare lo schema base e applicare tutte le migrazioni in ordine
lessicografico usando esclusivamente l'identità amministrativa. Esempio:

```bash
set -eu
psql "$NODRIVA_POSTGRES_ADMIN_URL" -v ON_ERROR_STOP=1 \
  -f db/schema/001_baseline_schema.sql
for migration in db/migrations/*.sql; do
  psql "$NODRIVA_POSTGRES_ADMIN_URL" -v ON_ERROR_STOP=1 -f "$migration"
done
```

`NODRIVA_POSTGRES_ADMIN_URL` è una variabile dell'operatore, da fornire mediante
il proprio flusso secret; non è una configurazione del Web. Non eseguire lo
schema base su un database già popolato. Un errore interrompe la sequenza:
non avviare l'applicazione finché migrazioni e controlli non sono conclusi.

Seguire [db/README.md](../db/README.md) per il ruolo `dashboard_app`, il login
dedicato e i vincoli del ruolo ristretto. Il processo Web non deve mai usare
`postgres`, un superuser o un'identità con privilegi DDL generici.

Impostare poi:

```text
DATABASE_ADAPTER=postgres
DATABASE_URL=postgresql://dashboard_web:<secret>@db.example.test:5432/nodriva?sslmode=require
REQUIRE_RESTRICTED_DB_ROLE=true
```

La password nella URI deve essere percent-encoded se contiene caratteri come
`@`, `/` o `#`. Per TLS privato predisporre la CA attendibile nel processo Node,
ad esempio tramite `NODE_EXTRA_CA_CERTS`; non disabilitare la verifica TLS.

### Bootstrap amministrativo fuori Docker

Lo schema SQL non crea l'utente iniziale e il Web PostgreSQL non esegue
automaticamente il seed. Con ambiente applicativo caricato e Core compilato,
eseguire il comando seguente dalla root. Usa il servizio autorevole già usato
da Compose, con il login applicativo ristretto in `DATABASE_URL`.

```bash
set -eu
set -a
. /etc/nodriva/nodriva.env
set +a
pnpm --filter @dashboard/core build
pnpm --filter @dashboard/core exec node --input-type=module <<'NODE'
import pg from 'pg';
import { PgExecutor, TransactionPortPostgres, SystemSeedPostgres } from './dist/index.js';
if (process.env.DATABASE_ADAPTER !== 'postgres' || !process.env.DATABASE_URL
    || !process.env.SEED_ADMIN_EMAIL || !process.env.SEED_ADMIN_PASSWORD) {
  throw new Error('Configurare profilo PostgreSQL, DATABASE_URL e credenziali seed');
}
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
try {
  const seed = new SystemSeedPostgres(
    new PgExecutor(pool), new TransactionPortPostgres(pool),
    process.env.SEED_ADMIN_PASSWORD, process.env.SEED_ADMIN_EMAIL,
  );
  await seed.seedDatabase();
  if (!await seed.checkSeeded()) throw new Error('Bootstrap incompleto');
  console.log('Bootstrap amministrativo completato');
} finally {
  await pool.end();
}
NODE
```

Un successo indica catalogo inizializzato, non dati demo caricati. Il bootstrap
non cambia la password di un account già presente e non sostituisce le
migrazioni. Non tentare di creare la prima identità dal pannello: l'azione UI
richiede già un superadmin autenticato.

Costruire e avviare il Web con i comandi del paragrafo SQLite, mantenendo però
`DATABASE_ADAPTER=postgres` e il relativo ambiente. Anche PostgreSQL richiede
la directory allegati persistente e scrivibile dall'account Web. Migrazioni e
bootstrap devono terminare prima che il Web accetti traffico.

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

Per il backup, il processo che genera dump/snapshot appartiene allo scheduler,
provider gestito o orchestratore scelto dall'operatore. Per mostrare l'esito in Nodriva deve
scrivere un manifest compatibile `last-status.json` e rendere quel solo file
leggibile dal Web. Il Web non crea, modifica né espone il backup. Consultare
[BACKUP_OPERATIONS.md](BACKUP_OPERATIONS.md) e [BACKUP_RESTORE.md](BACKUP_RESTORE.md).

## 6. Verifica dopo l'installazione

Prima di esporre l'istanza agli utenti verificare il processo avviato:

```bash
curl --fail --silent --show-error --output /dev/null http://127.0.0.1:3000/login
curl --fail --silent --show-error --output /dev/null https://nodriva.example.test/login
```

Adattare porta e URL; il secondo controllo vale per un deployment HTTPS.
Una risposta HTTP corretta non prova login, database o autorizzazione: completare
[FIRST_RUN.md](FIRST_RUN.md), verificare persistenza dopo riavvio, allegati e
integrazioni configurate. Per Compose usare anche
[OPERATIONS_READINESS.md](OPERATIONS_READINESS.md), specifico di quel profilo.

Typecheck, lint, test e build della release (`pnpm check`, integrazioni e E2E)
si eseguono in CI o in un ambiente isolato secondo
[RELEASE_CHECKLIST.md](RELEASE_CHECKLIST.md), non con credenziali, file o database
operativi. Non confondere una suite verde con un'installazione verificata.

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
- [Primo accesso e configurazione iniziale](FIRST_RUN.md)
- [Requisiti operativi, upgrade e troubleshooting Node.js](NODE_OPERATIONS.md)
