# Catalogo configurazioni runtime e deployment

Questo catalogo precede l'implementazione della configurazione backend. Ogni
nuova impostazione deve essere classificata prima di essere aggiunta a
`system_settings` o a un file di deployment.

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

### Database e infrastruttura — deployment/segreti

- `DATABASE_URL` e pool PostgreSQL;
- porte, binding e nomi DNS dei container;
- profili Compose (`realtime`, `monitoring`);
- URL pubblici dell'applicazione;
- secret database e credenziali di servizio.

Questi valori restano fuori da `system_settings`.

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

Il timeout sessione backend sarà la prima impostazione implementata dopo la
chiusura e approvazione di questo catalogo.
