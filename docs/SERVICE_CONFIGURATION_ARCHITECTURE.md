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

Il profilo standalone richiede ancora un adapter di persistenza compatibile,
per esempio SQLite. Non è sufficiente disabilitare il realtime o l'antivirus:
PostgreSQL è oggi l'unico adapter completo disponibile.

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
- i provider applicativi esistenti leggono ancora direttamente alcune variabili
  environment: il registry non è quindi ancora l'unico punto di risoluzione;
- gli healthcheck reali e i provider sostituibili non sono ancora collegati al
  registry operativo;
- esiste il registry applicativo dei healthcheck, ma non sono ancora registrati
  checker concreti per PostgreSQL, Soketi, ClamAV o gli altri provider;
- non è ancora disponibile un profilo standalone affidabile con il solo Node.

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

Un futuro adapter SQLite dovrà conservare gli stessi contratti applicativi di
quello PostgreSQL: ACL, gerarchia, transazioni, lock, `rowVersion`, audit,
soft delete, paginazione e outbox. La gerarchia potrà usare una closure table
(`ancestor_id`, `descendant_id`, `depth`) invece di PostgreSQL `ltree`.

La sostituzione del database sarà completa solo dopo test di contratto
condivisi tra gli adapter, inclusi concorrenza, rollback, scope `self`/`subtree`,
deny, spostamento di sottoalberi e replay dell'outbox.
