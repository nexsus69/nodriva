# Configurazione dei servizi e dei deployment

## Obiettivo architetturale

L'applicazione deve poter essere eseguita con diversi livelli di infrastruttura.
Il codice applicativo non deve assumere che Docker, PostgreSQL, Soketi, ClamAV,
Prometheus o un proxy siano sempre presenti.

| Profilo | Requisiti minimi | Uso previsto |
| --- | --- | --- |
| Standalone | Node.js e un adapter di persistenza locale | macchina senza servizi amministrabili |
| Distribuito | Node.js più servizi locali o remoti configurabili | produzione con servizi separati |
| Compose completo | tutti i container del repository | sviluppo e staging replicabile |

Il profilo standalone usa l'adapter SQLite integrato. Non è sufficiente
disabilitare realtime o antivirus: il composition root seleziona comunque un
profilo di persistenza completo.

## Stato attuale

Attualmente:

- il dominio e i servizi applicativi consumano porte/interfacce astratte;
- l'adapter PostgreSQL è l'unica implementazione completa della persistenza;
- gerarchia, ACL, lock, outbox e tabelle dinamiche usano semantiche PostgreSQL,
  inclusi `ltree`, JSONB e locking SQL;
- lo storage allegati è locale al filesystem o al volume del container;
- realtime e antivirus sono configurabili soprattutto tramite
  environment/Compose;
- `docker-compose.full.yml` avvia lo stack completo e rappresenta il profilo
  di sviluppo/staging, non un requisito architetturale dell'applicazione;
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
  degli schemi dinamici; il Web composition root usa ancora PostgreSQL e il
  e il composition root Web collega queste porte ai servizi applicativi.

La selezione avviene con `DATABASE_ADAPTER=sqlite` e
`SQLITE_DATABASE_PATH=...`; senza il primo valore il profilo PostgreSQL resta
quello predefinito. Build Web, avvio HTTP standalone e suite automatiche sono
stati verificati. Il test browser autenticato del lock amministrativo è stato
eseguito con due contesti Chromium e ha avuto esito positivo.

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

La sostituzione del database sarà completa solo dopo test di contratto
condivisi tra gli adapter, inclusi concorrenza, rollback, scope `self`/`subtree`,
deny, spostamento di sottoalberi e replay dell'outbox.
