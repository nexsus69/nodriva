# Dashboard Ultimate

[![CI](https://github.com/nexsus69/dashboard_ultimate/actions/workflows/ci.yml/badge.svg)](https://github.com/nexsus69/dashboard_ultimate/actions/workflows/ci.yml)

Dashboard Ultimate è una piattaforma open source per definire e gestire
strutture di dati collegate tra loro senza imporre un dominio applicativo
specifico. Il sistema fornisce primitive generiche — nodi, tipi, entità,
campi, riferimenti e allegati — sulle quali costruire applicazioni operative,
amministrative o di back office.

## Caratteristiche principali

- struttura gerarchica di nodi e risorse collegate;
- tipi e campi configurabili dal pannello amministrativo;
- form generati da uno schema comune con renderer specializzati;
- ACL, ruoli, scope e audit delle operazioni;
- lock ottimistici e realtime per evitare modifiche concorrenti;
- soft delete, cestino e ripristino di sottoalberi;
- allegati con scansione antivirus configurabile;
- cifratura configurabile per campi e allegati;
- cache applicativa con invalidazione tramite eventi realtime;
- backup PostgreSQL con restore verificato;
- stack Docker replicabile per sviluppo e staging.

Il progetto non è un CRM, ERP o ITSM preconfezionato: è un’infrastruttura
generica per modellare dati e relazioni, lasciando al dominio applicativo la
definizione dei casi d’uso.

## Architettura

Il monorepo contiene:

- `packages/core`: dominio, servizi applicativi, porte e adattatori;
- `packages/web`: interfaccia Next.js, Server Actions, API e pannello admin;
- `db`: migrazioni e bootstrap PostgreSQL;
- `docker-compose.full.yml`: stack completo replicabile;
- `e2e`: verifiche end-to-end browser;
- `docs`: documentazione architetturale e operativa.

PostgreSQL e SQLite sono i due profili di persistenza selezionabili dal
composition root Web. Il realtime comunica mutazioni e invalidazioni, ma non
sostituisce la persistenza né la verifica ACL lato server. Le mutation
amministrative applicano lock e controllo `rowVersion`. Il Compose completo è
solo uno dei profili di deployment.

## Avvio rapido

Creare un file `.env.docker` con i secret richiesti e avviare:

```bash
docker compose --env-file .env.docker -f docker-compose.full.yml up -d --build
```

La configurazione dettagliata, le porte e i volumi sono descritti in
[`docs/DOCKER_COMPOSE_FULL.md`](docs/DOCKER_COMPOSE_FULL.md).

## Verifiche

```bash
pnpm check
pnpm ops:health
```

Test browser autenticati, quando sono disponibili le variabili necessarie:

```bash
E2E_RUN=true E2E_EMAIL='utente@example.com' E2E_PASSWORD='password' E2E_USER_ID='user-id' E2E_BASE_URL='http://127.0.0.1:3001' pnpm e2e
```

La parità osservabile del pannello amministrativo fra SQLite e PostgreSQL si
verifica invece con un database PostgreSQL temporaneo derivato da
`dashboard_test`, un file SQLite temporaneo e due server production isolati:

```bash
pnpm e2e:admin-parity
```

Lo scenario visita tutte le sezioni amministrative, crea utenti, ruoli e tipi,
apre i relativi dettagli e confronta gli audit prodotti dai due adapter. I test
di lock concorrente e propagazione realtime restano nella suite E2E autenticata
generale.

La pipeline GitHub Actions esegue automaticamente installazione riproducibile,
typecheck, lint, suite core/web e build production. I test E2E autenticati e le
integrazioni PostgreSQL distruttive restano verifiche operative da eseguire con
un database e credenziali dedicati, mai con secret del repository.

Per la checklist di rilascio consultare
[`docs/OPERATIONS_READINESS.md`](docs/OPERATIONS_READINESS.md).
La checklist completa di release è in
[`docs/RELEASE_CHECKLIST.md`](docs/RELEASE_CHECKLIST.md).

## Documentazione

- [Architettura](ARCHITECTURE.md)
- [Stack Docker completo](docs/DOCKER_COMPOSE_FULL.md)
- [Lock amministrativi](docs/ADMIN_LOCKS.md)
- [Ciclo di vita realtime](docs/REALTIME_MUTATION_LIFECYCLE.md)
- [Cache e flusso dati frontend](packages/web/src/app/cache/ARCHITECTURE.md)
- [Backup e restore](docs/BACKUP_RESTORE.md)
- [Rotazione della cifratura](docs/ENCRYPTION_ROTATION.md)
- [Sicurezza operativa](docs/SECURITY_OPERATIONS.md)
- [Governance della documentazione](docs/DOCUMENTATION_GOVERNANCE.md)
- [Configurazione dei servizi e dei deployment](docs/SERVICE_CONFIGURATION_ARCHITECTURE.md)

## Sviluppo assistito da IA

Lo sviluppo di questo progetto è stato realizzato con l'ausilio di sistemi di
intelligenza artificiale, utilizzati come supporto per analisi, progettazione,
scrittura e revisione del codice, dei test e della documentazione.

Le decisioni architetturali, la verifica dei risultati, l'integrazione delle
modifiche e la responsabilità del progetto restano in capo al maintainer.

## Licenza

Il codice del progetto è distribuito con [Apache License 2.0](LICENSE).
Le dipendenze di terze parti mantengono le rispettive licenze. Attualmente il
nome e il logo del progetto non sono marchi registrati; il loro uso è descritto
nella [policy sul nome e sul logo](docs/TRADEMARK_POLICY.md). La licenza non
impone branding, telemetria o diciture “Powered by”.

## Stato del progetto

Il progetto è in sviluppo attivo. Sono disponibili i profili PostgreSQL e
SQLite; il primo è il profilo principale per Compose, il secondo consente
l'esecuzione standalone con il solo Node.js e un file locale. Restano attività
di maturazione su registry centralizzato dei provider, profili Compose
opzionali, secret manager, HTTPS, retention, replica, monitoraggio e disaster
recovery.

### Persistenza selezionabile

```bash
DATABASE_ADAPTER=sqlite SQLITE_DATABASE_PATH=./data/dashboard.sqlite SEED_ADMIN_PASSWORD='change-me' pnpm --filter @dashboard/web build
```

Il valore predefinito resta PostgreSQL. SQLite usa `parent_id` e closure table
al posto di `ltree`, mantenendo i port applicativi per transazioni, ACL, lock,
audit, revisioni, tipi, sessioni, cifratura e outbox. Il timeout di inattività
predefinito è 1800 secondi (30 minuti) in entrambi i profili.
