# Modello di prodotto e deployment

> **Stato: normativo.** Questo documento distingue il contratto applicativo,
> i profili di riferimento/test forniti dal repository e le responsabilita'
> dell'operatore. I documenti operativi specifici ne dettagliano le procedure.

## Contratto della piattaforma

Nodriva e' una piattaforma scaricabile e configurabile, non un servizio SaaS
gestito e non un gestionale pronto all'uso. Richiede sempre una persistenza
scelta e amministrata dall'operatore:

- PostgreSQL e' il profilo completo principale e puo' essere un'istanza esterna
  gia' esistente; Docker non e' un requisito dell'applicazione;
- SQLite e' il profilo standalone supportato con Node.js e un file locale;
- le funzionalita' comuni conservano lo stesso esito osservabile nei due
  adapter, mentre le integrazioni distribuite possono essere disabilitate.

Realtime/broker, antivirus, secret manager, backup schedulato, proxy/HTTPS,
metriche/alerting e worker separati sono integrazioni o processi opzionali,
scelti dal deployment. La loro assenza e' normale quando la capability e'
disabilitata. Se una capability e' abilitata, la relativa configurazione deve
essere completa e il deployment deve verificarne la salute.

Lo storage degli allegati e' necessario soltanto quando si usano allegati.
L'implementazione corrente usa un filesystem locale o montato; un provider a
oggetti non e' attualmente implementato e non va presentato come disponibile.

## Profili forniti dal repository

| Profilo | Scopo | Contenuto |
| --- | --- | --- |
| Node.js + SQLite | standalone locale | Web, file SQLite e filesystem allegati; nessun servizio esterno obbligatorio |
| Node.js + PostgreSQL esterno | deployment scelto dall'operatore | Web collegato tramite `DATABASE_URL`; migrazioni/bootstrap, proxy e integrazioni sono gestiti o omessi dall'operatore |
| `docker-compose.full.yml` | profilo di riferimento/test | PostgreSQL locale, migrazioni/bootstrap, Web e Caddy |
| overlay Compose | esempi opzionali | Soketi/worker, ClamAV, Prometheus e job backup selezionabili separatamente |
| `docker-compose.postgres-test.yml` | test distruttivi isolati | database con nome contenente `test` e bootstrap del ruolo ristretto |

Il profilo Compose non e' una distribuzione production-ready universale. In
particolare il file base include PostgreSQL e proxy locali e non e' il percorso
fornito per riusare un PostgreSQL esterno. L'immagine `docker/web` fornita usa
un entrypoint PostgreSQL; lo standalone SQLite si avvia direttamente con
Node.js. Un orchestratore personalizzato puo' riusare la configurazione
applicativa, ma deve gestire migrazioni, bootstrap, credenziali ristrette,
storage, TLS e lifecycle.

## Responsabilita' dell'operatore

L'operatore sceglie e protegge database, filesystem allegati, endpoint,
credenziali e chiavi; applica migrazioni; configura TLS e rete; decide quali
integrazioni abilitare; monitora disponibilita' e code; definisce backup,
retention, replica e restore; conserva insieme database, allegati e keyring.
Le procedure e gli esempi del repository non costituiscono SLA, servizio
gestito o certificazione del deployment risultante.

Il pannello amministrativo espone stato sanitizzato e policy runtime. Non crea
servizi esterni, non modifica la topologia del deployment e non sostituisce i
controlli dell'orchestratore o del provider.

## Mappa delle fonti operative

| Area | Fonte autorevole o di esempio |
| --- | --- |
| confini applicativi e adapter | `ARCHITECTURE.md`, `ARCHITECTURAL_PORTABILITY.md` |
| classificazione runtime/deployment/secret | `SERVICE_CONFIGURATION_ARCHITECTURE.md`, `RUNTIME_CONFIGURATION_CATALOG.md` |
| profilo Compose e overlay | `DOCKER_COMPOSE_FULL.md`, `docker-compose*.yml`, `scripts/docker-compose-profile-contract.sh` |
| configurazione iniziale | `.env.example`, `.env.infisical.example` |
| migrazioni e bootstrap PostgreSQL | `db/README.md`, `docker/db-migrate/`, `docker/db-seed/` |
| immagini e processi forniti | `docker/*/Dockerfile`, `docker/web/runtime-entrypoint.sh`, `docker/realtime-worker/` |
| backup e restore | `BACKUP_RESTORE.md`, `BACKUP_OPERATIONS.md`, `scripts/*backup*`, `ops/systemd/` |
| sicurezza e secret | `SECURITY.md`, `SECURITY_OPERATIONS.md`, `SECRET_MANAGEMENT.md` |
| healthcheck e osservabilita' | `OPERATIONS_READINESS.md`, `scripts/stack-healthcheck.sh`, `docker/prometheus/` |
| configurazione Core/Web | `packages/core/src/application/config/`, `packages/web/src/server/EnvironmentServiceConfiguration.ts`, `packages/web/src/server/db.ts` |
| test dei profili | `.github/workflows/ci.yml`, `docker-compose.postgres-test.yml`, `scripts/admin-parity-e2e.sh` |

`docker-compose.yml` e' un file legacy/minimale separato dal profilo completo:
non avvia il Web e non rappresenta un'installazione Nodriva completa.
