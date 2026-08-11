# Dashboard Ultimate

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

PostgreSQL è la fonte persistente dei dati. Il realtime comunica mutazioni e
invalidazioni, ma non sostituisce la persistenza né la verifica ACL lato
server. Le mutation amministrative applicano lock e controllo `rowVersion`.

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
E2E_RUN=true pnpm e2e
```

Per la checklist di rilascio consultare
[`docs/OPERATIONS_READINESS.md`](docs/OPERATIONS_READINESS.md).

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

## Stato del progetto

Il progetto è in sviluppo attivo. La compose completa copre sviluppo e
staging replicabile; prima dell’uso in produzione devono essere definiti
secret manager, HTTPS, retention, replica, monitoraggio e disaster recovery.
