# Configurazione dei servizi e dei deployment

## Obiettivo architetturale

L'applicazione deve poter essere eseguita con diversi livelli di infrastruttura.
Il codice applicativo non deve assumere che Docker, PostgreSQL, Soketi, ClamAV,
Prometheus o un proxy siano sempre presenti.

| Profilo | Requisiti minimi | Uso previsto |
| --- | --- | --- |
| Standalone | Node.js e un adapter di persistenza locale | macchina senza servizi amministrabili |
| Distribuito | Node.js, persistenza e servizi locali o remoti scelti dall'operatore | deployment con servizi separati |
| Compose di riferimento/test | PostgreSQL, migrazioni/bootstrap, Web e proxy; overlay espliciti per le integrazioni | sviluppo, dimostrazione e test replicabile |

Il profilo standalone usa l'adapter SQLite integrato. Non è sufficiente
disabilitare realtime o antivirus: il composition root seleziona comunque un
profilo di persistenza completo.

## Stato attuale

Attualmente:

- il dominio e i servizi applicativi consumano porte/interfacce astratte;
- PostgreSQL e SQLite sono profili di persistenza completi selezionabili dal
  composition root; usano meccanismi fisici diversi dietro gli stessi port;
- PostgreSQL usa `ltree`, JSONB, locking SQL e tabelle dinamiche fisiche;
  SQLite usa `parent_id`, closure table, payload JSON e metadata relazionali;
- lo storage allegati è locale al filesystem o al volume del container;
- realtime e antivirus sono configurabili soprattutto tramite
  environment/Compose;
- `docker-compose.full.yml` avvia il riferimento PostgreSQL di base; gli overlay
  `docker-compose.realtime.yml`, `docker-compose.antivirus.yml`,
  `docker-compose.monitoring.yml` e `docker-compose.backup.yml` sono opzionali e non sono
  dipendenze di avvio del Web. Il file resta un esempio di sviluppo/staging,
  non un requisito architetturale dell'applicazione;
- esistono il registry descrittivo, il resolver applicativo, il repository
  PostgreSQL versionato per i valori runtime e la sorgente environment collegata
  al composition root Web;
- il composition root Web risolve ora anche le chiavi di cifratura dei campi,
  degli allegati e dell'MFA tramite il servizio `security-keys`; i valori restano
  secret di deployment e non vengono persistiti nella configurazione runtime;
- alcuni valori di bootstrap restano necessariamente forniti prima del container
  applicativo: `DATABASE_URL` alimenta il provider PostgreSQL e la policy del
  ruolo PostgreSQL resta una guardia di avvio;
- il registry applicativo ha checker concreti per PostgreSQL, SQLite, Soketi e ClamAV,
  collegati al servizio di healthcheck;
  gli altri provider restano `not-configured` finché non viene aggiunto il
  relativo adapter;
- il profilo SQLite dispone di schema, transaction root, closure table,
  nodi, entità JSON, tipi, ACL, lock, audit, revisioni, outbox, utenti,
  sessioni, rate limiting, token account, configurazione runtime e metadata
  degli schemi dinamici; il composition root Web collega il profilo selezionato
  agli stessi servizi applicativi.

Il runtime PostgreSQL accetta una `DATABASE_URL` verso un'istanza esterna. Il
Compose fornito include invece un PostgreSQL locale e non offre un overlay per
rimuoverlo; migrazioni, bootstrap e ruolo ristretto di un database esterno sono
responsabilita' dell'operatore. Analogamente, l'immagine Web fornita ha un
entrypoint PostgreSQL: il profilo SQLite standalone usa l'avvio Node.js.

La selezione avviene con `DATABASE_ADAPTER=sqlite` e
`SQLITE_DATABASE_PATH=...`; senza il primo valore il profilo PostgreSQL resta
quello predefinito. Build Web, avvio HTTP standalone e suite automatiche sono
stati verificati. Due server production isolati verificano sia la parità del
pannello amministrativo sia la verticale canonica comune su SQLite e
PostgreSQL (`pnpm e2e:parity`).

La persistenza runtime delle configurazioni è preparata dalla migrazione
`db/migrations/030_service_configurations.sql`; deployment e secret restano
deliberatamente fuori da questa tabella.

## Stato obiettivo

Ogni servizio infrastrutturale dovrà essere selezionato e configurato tramite
un adapter/provider, senza modificare il dominio applicativo:

```text
Application
 ├── PersistenceProvider
 ├── RealtimeProvider
 ├── AttachmentStorageProvider
 ├── AntivirusProvider
 ├── MailProvider
 ├── BackupProvider
 └── ObservabilityProvider
```

Per ogni provider dovranno essere distinguibili capability, provider,
endpoint, riferimenti ai secret, timeout, retry, limiti, healthcheck e
necessità di riavvio. La UI potrà mostrare stato ed endpoint non sensibili, ma
non password, chiavi private o token.

## Contratto implementato per configurazione e stato

Il registry descrive provider, requirement (`required`/`optional`), fallback,
dipendenze e lifecycle. I servizi opzionali senza deployment si presentano come
`disabled`; database e storage allegati rimangono requirement di bootstrap.
`ServiceConfigurationService` mantiene la precedenza deployment → runtime →
derived e rifiuta un provider runtime diverso da quello di deployment.
`ServiceAdministrationApplicationService` espone un catalogo redatto,
healthcheck non mutanti e, tramite l'opzionale `BackupStatusPort`, evidenza di
backup sanitizzata dietro `system.config.read`. Il port legge solamente il
manifest operativo; non esegue backup né restore. Un deployment che non espone
un reader restituisce lo stato esplicito `unavailable`.

Nel profilo standalone, `attachment-storage` viene bootstrapato esplicitamente
come filesystem su `./.data/attachments` se `ATTACHMENTS_ROOT` non è definita;
non è più un fallback invisibile del solo adapter locale.

**Platform → Integrations**, **Data & recovery** e **Health & observability**
sono intenzionalmente read-only per deployment e secret. Le viste mostrano
provider sanitizzato, stato, fallback, dipendenze e lifecycle dei servizi
esistenti; Data & recovery mostra anche il manifest di verifica backup
sanitizzato quando il deployment lo fornisce. Non modificano environment,
endpoint, password o secret. S3-compatible e SMTP restano soltanto previsti dal
piano finché non esistono adapter, healthcheck e test di contratto.

## Classificazione

1. **Runtime**: impostazioni funzionali modificabili con autorizzazione,
   validazione, versione e audit.
2. **Deployment**: indirizzi, porte, provider e topologia definiti dall'avvio
   o dall'orchestratore.
3. **Secret**: password, chiavi e token custoditi da environment protetto,
   Docker secrets, Vault, KMS o secret manager equivalente.
4. **Derivata**: valori calcolati da una configurazione autorevole.

## Adapter di persistenza

L'adapter SQLite implementa gli stessi contratti applicativi principali di
quello PostgreSQL: ACL, gerarchia, transazioni, lock, `rowVersion`, audit,
soft delete, paginazione, cifratura dei campi e outbox. La gerarchia usa una
closure table (`ancestor_id`, `descendant_id`, `depth`) invece di PostgreSQL
`ltree`.

I test di contratto condivisi, l'E2E amministrativo e l'E2E canonico verificano
la parità osservabile fra i due adapter, comprese ACL scoped, lock per sessione,
concorrenza ottimistica, relazioni e lifecycle delete/restore. Restano necessari
test specifici per le semantiche native non riproducibili in modo identico, in
particolare claim concorrenti dell'outbox e DDL fisico PostgreSQL.
