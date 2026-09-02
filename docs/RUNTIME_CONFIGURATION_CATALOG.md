# Catalogo configurazioni runtime e deployment

Questo catalogo descrive il modello obiettivo della configurazione backend.
L'implementazione attuale è parziale: alcune capability sono già in
`system_settings` o nell'environment; il core possiede registry, resolver e
repository PostgreSQL per i valori runtime e il Web possiede una sorgente
environment collegata al composition root. I provider applicativi leggono però
ancora direttamente alcune variabili e gli healthcheck reali non sono ancora
collegati. Ogni nuova impostazione deve
essere classificata prima di essere aggiunta a `system_settings`, a un file di
deployment o a un secret manager.

Per la distinzione tra stato attuale e obiettivo consultare
[`SERVICE_CONFIGURATION_ARCHITECTURE.md`](./SERVICE_CONFIGURATION_ARCHITECTURE.md).

## Regole di classificazione

| Classe | Persistenza | Modificabile dal pannello | Esempi |
| --- | --- | --- | --- |
| Runtime | `system_settings` | Sì, con autorizzazione e audit | timeout sessione, limiti UI, capability |
| Deployment | environment/Compose/orchestratore | No | host Docker, porte, URL interni |
| Segreto | secret manager/environment protetto | No | password, chiavi, token, webhook secret |
| Derivata | nessuna propria | No | heartbeat, polling, TTL lock |

La configurazione runtime deve avere validazione, default, limiti, versione
ottimistica (`row_version`) e audit. I segreti non devono essere restituiti al
client. Le configurazioni deployment richiedono normalmente riavvio o redeploy
e non devono essere simulate come impostazioni amministrative runtime.

## Stato effettivo dei servizi opzionali

Il catalogo eseguibile `ServiceConfigurationRegistry` classifica ogni servizio
come `required` oppure `optional`, con dipendenze, fallback e lifecycle
(`hot`, `process-restart`, `rebuild`, `redeploy`). Un servizio optional senza
deployment risolve al provider esplicito `disabled`: è uno stato normale, non
un errore client. Il provider del deployment ha precedenza invariabile sui
valori runtime; il runtime può cambiare solo policy del medesimo provider.

La vista pubblica autorizzata include provider, stato, fallback, lifecycle e
dipendenze, mai endpoint, path, porte, secret o riferimenti a secret.

## Catalogo iniziale

### Sessione e sicurezza — runtime

- `session_idle_timeout_seconds`: inattività massima della sessione;
- numero massimo di sessioni attive per utente;
- durata e limiti dei token di recupero account;
- durata dei tentativi di rate limit;
- policy MFA e finestra di tolleranza, se resa configurabile.

Heartbeat, polling, TTL lock, safety buffer e cache sweep devono essere derivati
da `session_idle_timeout_seconds`; non sono chiavi indipendenti.

### Capability e comportamento applicativo — runtime

- capability già presenti (`locking`, `entities_structure`,
  `hierarchical_structure`);
- limiti di paginazione e numero massimo di elementi per richiesta;
- dimensione massima dei payload;
- limiti upload e allegati;
- retention e modalità di esportazione audit;
- registrazione dell'attività ordinaria dei lock, senza sopprimere conflitti o
  rilasci amministrativi;
- eventuali policy funzionali globali.

### Realtime — misto

Runtime:

- realtime abilitato/disabilitato;
- intervalli operativi del worker, solo se non derivati e realmente necessari;
- limiti di retry e backlog, con cautela e audit.

Deployment:

- host e porta interni di Pusher/Soketi;
- URL del worker realtime e endpoint di drain;
- endpoint pubblico usato dal browser;
- app id, key, cluster e schema di rete.

Segreti:

- secret Pusher/Soketi;
- `REALTIME_WORKER_SECRET`;
- credenziali di autenticazione dei trasporti.

Un indirizzo come `127.0.0.1` è una proprietà del contesto di rete del processo,
non un valore da far modificare a un amministratore dal browser. Devono essere
distinti endpoint interno server-side ed endpoint pubblico client-side.

Il modello obiettivo aggiunge provider, endpoint interno/pubblico, porta,
schema, timeout, retry, healthcheck, dipendenze e requisito di riavvio.

### Database e infrastruttura — deployment/segreti

- `DATABASE_URL` e pool PostgreSQL;
- porte, binding e nomi DNS dei container;
- profili Compose (`realtime`, `antivirus`, `monitoring`, `backup`), che sono
  opzioni del deployment di riferimento e non capability applicative implicite;
- URL pubblici dell'applicazione;
- secret database e credenziali di servizio.

Questi valori restano fuori da `system_settings`. Il provider di persistenza è
selezionabile tramite `DATABASE_ADAPTER=postgres|sqlite`; ogni ulteriore adapter
richiederà migrazioni proprie, test di contratto condivisi ed E2E di parità.

### Backup e recupero — deployment con evidenza read-only

- il provider backup è `postgres-dump` per PostgreSQL e `sqlite-snapshot` per
  SQLite; `BACKUP_ROOT` identifica soltanto il contesto operativo di backup;
- `BACKUP_STATUS_FILE`, quando il deployment lo espone al processo Web, è una
  fonte opzionale di evidenza e non un'impostazione runtime;
- il contenuto pubblico ammesso è provider, data, checksum, dimensione,
  versione schema, restore verification e dipendenze coordinate per allegati e
  keyring; path, nome file, target, credenziali e contenuto del backup restano
  non esposti;
- in assenza del reader lo stato è `unavailable`; avvio backup e restore
  restano procedure operative fuori dal pannello.

### Integrazioni esterne — deployment/segreti

- URL e timeout di webhook;
- SMTP o provider email;
- storage oggetti e CDN;
- credenziali e chiavi API;
- URL pubblici per callback e reset account.

Endpoint non segreti possono essere configurati dall'ambiente di deployment;
token e password devono usare un secret manager.

### Osservabilità — misto

Runtime:

- livello di logging applicativo, se consentito dalla policy;
- soglie operative e retention metriche non sensibili.

Deployment:

- endpoint metrics;
- target Prometheus;
- credenziali e secret di scraping;
- tracing/exporter e relativi endpoint.

## Contratto comune dei servizi — obiettivo

Ogni servizio deve descrivere almeno:

| Aspetto | Esempi |
| --- | --- |
| Capability | abilitato, disabilitato, obbligatorio |
| Provider | PostgreSQL, SQLite, Soketi, Pusher, ClamAV, filesystem; S3 è solo pianificato |
| Endpoint | host, porta, schema, database, bucket, percorso |
| Secret | riferimento esterno, mai valore nel client |
| Affidabilità | timeout, retry, backoff, pool, limiti |
| Salute | healthcheck, stato, ultima verifica |
| Lifecycle | hot reload, riavvio, redeploy |
| Dipendenze | servizi richiesti e fallback consentiti |

## Contratto minimo di ogni setting

Prima dell'implementazione, ogni voce deve specificare:

1. chiave e categoria;
2. tipo e schema di validazione;
3. default, minimo e massimo;
4. origine autorevole;
5. modificabilità a runtime;
6. eventuale riavvio richiesto;
7. visibilità client e natura segreta;
8. autorizzazione richiesta e evento di audit;
9. impatto sui valori derivati e sulle sessioni già attive.

`session.idleTimeoutSeconds` esiste già nei seed e viene allineato a 1800
secondi dalla migrazione `033`. La temporanea fonte effettiva condivisa da Web
e browser resta `NEXT_PUBLIC_SESSION_IDLE_TIMEOUT_SECONDS`: il passaggio alla
lettura runtime autorevole del setting, senza rebuild, rimane aperto.
