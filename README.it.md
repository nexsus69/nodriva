# Nodriva

[English](README.md) | [Italiano](README.it.md)

[![CI](https://github.com/nexsus69/nodriva/actions/workflows/ci.yml/badge.svg)](https://github.com/nexsus69/nodriva/actions/workflows/ci.yml)

Nodriva è una piattaforma open source per definire e gestire strutture di dati
collegati senza imporre uno specifico dominio applicativo. Offre primitive
generiche — nodi, tipi, entità, campi, riferimenti e allegati — con cui costruire
applicazioni operative, amministrative o di back-office.

## Funzionalità principali

- Nodi gerarchici e risorse collegate.
- Tipi e campi configurabili dal pannello amministrativo.
- Form guidati dallo schema con renderer specializzati.
- Protezione dalla perdita di modifiche operative e amministrative non salvate.
- ACL, ruoli, scope e audit delle operazioni.
- Lock ottimistici e aggiornamenti realtime per modifiche concorrenti.
- Cancellazione logica, cestino e ripristino dei sottoalberi.
- Allegati con scansione antivirus opzionale.
- Cifratura configurabile di campi e allegati.
- Invalidazione della cache applicativa tramite realtime.
- Backup PostgreSQL con restore verificato.
- Stack Docker Compose di riferimento per sviluppo e staging, con integrazioni opzionali.

Nodriva non è un CRM, ERP o ITSM pronto all'uso. È un'infrastruttura generica per
modellare dati e relazioni, lasciando i casi d'uso al dominio applicativo.

Nodriva viene scaricato ed eseguito nell'infrastruttura scelta dall'utente:
non è un SaaS ospitato né un deployment gestito. La persistenza è obbligatoria.
PostgreSQL può essere un'istanza esterna esistente, mentre SQLite supporta un
profilo locale standalone. Broker, antivirus, secret manager, scheduler backup,
proxy, metriche e worker separati sono integrazioni opzionali scelte dall'operatore.

## Architettura

Il monorepo contiene:

- `packages/core`: dominio, servizi applicativi, port e adapter;
- `packages/web`: interfaccia Next.js, Server Actions, API e pannello amministrativo;
- `db`: migrazioni e bootstrap PostgreSQL;
- `docker-compose.full.yml`: stack PostgreSQL di riferimento; le integrazioni opzionali usano overlay Compose espliciti;
- `e2e`: verifiche end-to-end nel browser;
- `docs`: documentazione architetturale e operativa.

PostgreSQL e SQLite sono profili di persistenza selezionabili. Il realtime
comunica mutazioni e invalidazioni, ma non sostituisce mai persistenza o
controlli ACL server-side. Le mutazioni amministrative verificano lock e
`rowVersion`. Lo stack Compose completo è un profilo di deployment, non
l'unico runtime supportato.

Entrambi i profili condividono il bootstrap amministrativo configurato da
`SEED_ADMIN_EMAIL` e `SEED_ADMIN_PASSWORD`. Il bootstrap è transazionale,
additivo e idempotente: inizializza account, ruoli, permessi, capability e
impostazioni mancanti senza eliminare dati applicativi.

## Installazione

Per un percorso completo e indipendente dal deployment — SQLite standalone,
PostgreSQL esterno, integrazioni opzionali e verifica operativa — leggere la
[guida di installazione](docs/INSTALLATION.md).

Una nuova installazione contiene amministratore e cataloghi di sistema, non
nodi, entità o tipi applicativi demo. Proseguire con il
[primo utilizzo](docs/FIRST_RUN.md) e con
[operatività Node.js, aggiornamenti e diagnosi](docs/NODE_OPERATIONS.md).

## Avvio rapido

I comandi seguenti avviano il profilo PostgreSQL di riferimento/test del
repository. Non sono l'unico metodo di installazione e non costituiscono un
deployment universalmente pronto per la produzione. Con Node.js e SQLite o
PostgreSQL esterno, avviare il Web con l'ambiente scelto ed eseguire separatamente
bootstrap e migrazioni pertinenti. Vedere il
[modello di deployment](docs/DEPLOYMENT_MODEL.md).

Creare una `.env.docker` protetta con i valori richiesti e avviare il profilo base:

```bash
docker compose --env-file .env.docker -f docker-compose.full.yml up -d --build
```

Realtime, antivirus, monitoraggio e backup sono profili opzionali espliciti:

```bash
docker compose --env-file .env.docker \
  -f docker-compose.full.yml \
  -f docker-compose.realtime.yml \
  -f docker-compose.antivirus.yml \
  -f docker-compose.monitoring.yml \
  -f docker-compose.backup.yml up -d --build
```

Porte, volumi e configurazione sono descritti in
[`docs/DOCKER_COMPOSE_FULL.md`](docs/DOCKER_COMPOSE_FULL.md).

## Verifica

```bash
pnpm check
pnpm ops:health
```

`pnpm e2e` predispone fixture SQLite/PostgreSQL isolate, server Next.js temporanei
e un broker realtime, quindi esegue l'intero gate browser. Non usa mai il
database operativo. Per analizzare una singola verticale restano disponibili:

```bash
pnpm e2e:admin-parity
pnpm e2e:canonical
pnpm e2e:parity
pnpm e2e:full
```

Lo scenario canonico configura tipi, enum e relazioni, crea un utente con ruolo
e scope, verifica il diniego fuori scope, esercita lock e `rowVersion` con due
sessioni e controlla cancellazione, ripristino e audit.

GitHub Actions esegue installazione riproducibile, typecheck, lint, test Core/Web
e build production. Job separati inizializzano database PostgreSQL 17 isolati,
verificano migrazioni e ruolo applicativo ristretto, eseguono la suite di
integrazione/contract PostgreSQL e `pnpm e2e:parity` con Chromium su SQLite e
PostgreSQL.

## Documentazione

- [Architettura](ARCHITECTURE.md)
- [Modello di prodotto e deployment](docs/DEPLOYMENT_MODEL.md)
- [Contribuire](CONTRIBUTING.md)
- [Policy di sicurezza](SECURITY.md)
- [Checklist di accettazione Nodriva](docs/NODRIVA_ACCEPTANCE_CHECKLIST.md)
- [Stack Docker completo](docs/DOCKER_COMPOSE_FULL.md)
- [Lock amministrativi](docs/ADMIN_LOCKS.md)
- [Ciclo di vita delle mutazioni realtime](docs/REALTIME_MUTATION_LIFECYCLE.md)
- [Cache e flusso dati frontend](packages/web/src/app/cache/ARCHITECTURE.md)
- [Backup e restore](docs/BACKUP_RESTORE.md)
- [Rotazione della cifratura](docs/ENCRYPTION_ROTATION.md)
- [Sicurezza operativa](docs/SECURITY_OPERATIONS.md)
- [Governance della documentazione](docs/DOCUMENTATION_GOVERNANCE.md)
- [Configurazione di servizi e deployment](docs/SERVICE_CONFIGURATION_ARCHITECTURE.md)

## Licenza

Il codice è distribuito con [licenza Apache 2.0](LICENSE). Le dipendenze di terze
parti mantengono le rispettive licenze. Nome e logo del prodotto sono coperti
dalla [policy su nome e logo](docs/TRADEMARK_POLICY.md).

## Sviluppo Assistito da Intelligenza Artificiale

Nodriva è stato ideato, progettato e diretto da **Marco Sartini**, e sviluppato
attraverso sessioni di pair programming con modelli avanzati di Intelligenza
Artificiale. L'architettura, i confini di dominio, i contratti operativi e il
codice sono stati prodotti mediante flussi agentici sotto continua guida e
rigorosa verifica umana.

## Stato del progetto

Nodriva è in sviluppo attivo. PostgreSQL è il profilo completo principale;
SQLite permette l'esecuzione standalone con Node.js e un file locale. Provider
runtime, profili opzionali, disaster recovery e altre funzionalità enterprise
restano deliberatamente incrementali.

### Persistenza selezionabile

```bash
DATABASE_ADAPTER=sqlite SQLITE_DATABASE_PATH=./data/nodriva.sqlite \
SEED_ADMIN_PASSWORD='change-me' pnpm --filter @dashboard/web build
```

Il default resta PostgreSQL. SQLite usa `parent_id` e una closure table invece
di `ltree`, preservando i port applicativi per transazioni, ACL, lock, audit,
revisioni, tipi, sessioni, cifratura e outbox. Il timeout di inattività predefinito
è 1.800 secondi (30 minuti) in entrambi i profili.
