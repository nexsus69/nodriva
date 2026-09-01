# Piano di configurazione completa dei servizi Nodriva

> Stato: punti 1, 2, 3 e 4 completati il 1 settembre 2026. Il catalogo
> riutilizzabile, la precedenza deployment→runtime, lo stato `disabled` degli
> optional e la vista Admin sanitizzata sono stati introdotti; provider S3/SMTP,
> backup SQLite e l'editing runtime auditato restano interventi separati.

## 1. Esito e principi decisionali

Nodriva deve trattare Docker Compose come una distribuzione di riferimento, non
come il modello architetturale. Ogni processo deve ricevere una configurazione
provider-agnostic valida prima di costruire gli adapter; i servizi opzionali
devono avere uno stato esplicito `disabled` e non essere dedotti dall'assenza
accidentale di una variabile.

La configurazione va separata in quattro piani, senza sovrapposizioni:

| Piano | Decisione e proprietario | Mutabilità | Destinazione |
| --- | --- | --- | --- |
| Bootstrap/deployment | Provider, topologia, endpoint, credenziali di avvio, percorsi e pool scelti dall'operatore del deployment | Riavvio/redeploy, salvo adapter futuri progettati per reload | Environment tipizzato, file protetto, orchestratore o config provider |
| Secret | Password, token, chiavi di firma/cifratura e credenziali provider | Rotazione controllata; mai dal normale pannello | Secret manager o riferimento `secret://...` risolto server-side |
| Runtime | Policy funzionali che un amministratore autorizzato può cambiare senza ricostruire adapter | Hot reload con versione ottimistica e audit | `system_settings` o, solo per policy proprie del servizio, `service_configurations` |
| Derivato | Valori calcolati da una sola fonte autorevole | Non modificabile | Memoria/read model; mai persistito come seconda fonte |

Decisioni operative consentite all'amministratore applicativo:

- attivare/disattivare una capability solo se il deployment dichiara che il
  provider è disponibile; una capability richiesta non può essere disattivata;
- scegliere policy di fallback (`best-effort` o `fail-closed`) entro i limiti
  imposti dal deployment e dalla sicurezza;
- impostare limiti, retention funzionale, timeout applicativi e retry dichiarati
  runtime-editable;
- consultare provider, stato, ultima verifica, latenza, dipendenze, impatto e
  necessità di riavvio in forma sanitizzata;
- richiedere una verifica di salute e consultare gli eventi audit relativi alle
  modifiche runtime.

Restano decisioni dell'operatore di deployment: database e provider fisico,
host/porte/schema, URL pubblici, TLS, pool, bucket/path, credenziali, chiavi,
target di telemetria, scheduler di backup e restore operativo. Il pannello non
deve diventare un editor di environment né un secret manager.

## 2. Stato reale verificato

### 2.1 Git e CI

- branch `main`, HEAD `277a984`, allineato a `origin/main` al momento del
  censimento;
- working tree già modificato dall'utente in
  `packages/web/src/app/admin/_components/AdminPanelShell.tsx`; il file è fuori
  dal perimetro di questo piano e deve essere preservato;
- run CI dell'HEAD `33422560177`: verdi `Typecheck, lint, test and build` e
  `PostgreSQL integration and adapter parity`; rosso `Browser parity on SQLite
  and PostgreSQL`, nello step `Run SQLite/PostgreSQL browser parity`;
- il precedente HEAD `4d4d834` aveva CI interamente verde. La baseline di ogni
  implementazione futura deve prima riprodurre e classificare il fallimento E2E
  corrente, senza attribuirlo automaticamente alla configurazione servizi.

### 2.2 Componenti già implementati

- `ServiceConfigurationRegistry` descrive otto famiglie: `database`,
  `realtime`, `attachment-storage`, `antivirus`, `mail`, `backup`,
  `observability`, `security-keys`;
- `ServiceConfigurationService` unisce deployment e runtime, valida le chiavi,
  risolve riferimenti secret e produce una vista pubblica filtrata;
- repository versionati per `service_configurations` esistono per PostgreSQL e
  SQLite; la migrazione PostgreSQL è `030_service_configurations.sql`;
- `EnvironmentServiceDeploymentConfigurationSource` è collegata al composition
  root Web e traduce environment per database, realtime, filesystem, ClamAV,
  webhook mail, backup, Prometheus e chiavi di sicurezza;
- healthcheck concreti esistono per PostgreSQL, SQLite, Soketi/Pusher-compatible
  e ClamAV; gli altri risultano senza checker;
- persistenza completa PostgreSQL/SQLite, outbox, ACL, lock, audit e
  configurazione runtime hanno adapter per entrambi i profili;
- storage allegati effettivo: solo filesystem (`LocalAttachmentStorage`), con
  cifratura AES-GCM e keyring;
- antivirus effettivo: ClamAV via TCP `INSTREAM`, opzionale nel composition root;
- consegna account effettiva: webhook HTTP opzionale, non SMTP;
- realtime effettivo: protocollo Pusher con Soketi nel Compose, outbox e worker
  HTTP autenticato;
- backup effettivo: script PostgreSQL `pg_dump` con checksum e restore di
  verifica; non esiste un `BackupProvider` applicativo né backup SQLite;
- osservabilità effettiva: metriche realtime/workflow esposte a Prometheus nel
  Compose; manca un provider applicativo generale.

### 2.3 Implementato ma incompleto o non collegato

- `ServiceConfigurationService.setRuntimeValues()` e la tabella
  `service_configurations` non sono esposti da use case Admin autorizzati e
  auditati;
- il read model Admin e le action per configurazioni/healthcheck sono presenti;
  i risultati espongono codici stabili e messaggi sanitizzati, mentre i
  dinieghi di autorizzazione continuano a propagarsi come errori applicativi;
- il registry non esprime default, min/max, enum, unità, timeout, retry,
  dipendenze, fallback, requisito/optionalità, disponibilità del deployment o
  strategia di reload;
- `enabled` per realtime e antivirus è ora composto dal
  `EffectiveCapabilityResolver`; i consumer applicativi non interrogano più
  direttamente la capability runtime `realtime` né il setting antivirus;
- restano da migrare eventuali strumenti amministrativi legacy che scrivono
  ancora le vecchie righe di capability, mantenendo compatibilità di lettura;
- il resolver sceglie il provider da runtime prima che dal deployment, pur
  vietando in scrittura un provider diverso: una riga storica incoerente può
  quindi alterare la risoluzione;
- realtime e scanner sono costruiti dal deployment al bootstrap; i flag runtime
  aggiornano lo stato effettivo, ma la ricostruzione degli adapter richiede
  ancora riavvio secondo il contratto di reload;
- `RealtimeHttpHealthCheck` forza `http://` e ignora `internalScheme`;
- i timeout dei checker sono hardcoded a 3 secondi e quello dello scanner ha un
  default separato di 30 secondi;
- filesystem cade su `.data/attachments` quando non configurato: utile nello
  standalone, ma oggi è un fallback implicito e non uno stato dichiarato;
- S3-compatible è soltanto progettato per una futura esigenza concreta; non è
  registrato, dipendenza o configurazione runtime;
- `mail` registra solo `webhook`, mentre la documentazione generale cita SMTP;
- webhook mail usa un timeout di deployment (`ACCOUNT_ACTION_DELIVERY_TIMEOUT_MS`,
  default 10 secondi); retry, idempotency key e healthcheck restano differiti;
- backup e osservabilità sono mappati dall'environment ma non consumati dal
  composition root applicativo;
- `security-keys` è correttamente deployment-only ma è incluso nello stesso
  catalogo dei servizi esponibili: deve restare una sezione di readiness
  sanitizzata, non una configurazione Admin.

### 2.4 Scostamenti tra documentazione e codice

| Categoria | Evidenza |
| --- | --- |
| Documentato e mancante | SMTP/provider email, object storage reale, CDN, provider/port applicativi per backup e osservabilità, healthcheck per storage/mail/backup/metrics, configurazione runtime autorevole della sessione nel browser, retry/backoff/limiti completi |
| Nel codice ma poco/non documentato nei cataloghi | provider mail effettivo `webhook`; `security-keys` come famiglia del registry; `ACCOUNT_ACTION_*`; `MFA_ENCRYPTION_KEY`; fallback filesystem `.data/attachments`; `REQUIRE_RESTRICTED_DB_ROLE`; healthcheck che forza HTTP; assenza di timeout nel webhook |
| Docker-specifico da rendere provider-agnostic | host `postgres`, `soketi`, `clamav`, `web`; dipendenze obbligatorie del `docker-compose.full.yml`; worker shell che drena URL Web; backup che assume container PostgreSQL e volume; Prometheus che riusa `REALTIME_WORKER_SECRET`; Caddy e porte/build arg `NEXT_PUBLIC_*` |
| Correttamente fuori dall'Admin | `DATABASE_URL`, `SQLITE_DATABASE_PATH`, credenziali DB, chiavi Pusher/worker, chiavi cifratura/MFA, password SMTP/object storage, path e target operativi, restricted DB role, seed/bootstrap admin, bind/proxy/TLS, restore target |

I tre documenti di confronto sono coerenti sulla classificazione generale, ma
`RUNTIME_CONFIGURATION_CATALOG.md` descrive un obiettivo più ricco del registry;
`SERVICE_CONFIGURATION_ARCHITECTURE.md` sovrastima la completezza dei checker
rispetto a storage/mail/backup/observability; `ADMIN_INFORMATION_ARCHITECTURE.md`
assegna correttamente `Platform → Runtime and integrations`, ma la schermata
attuale gestisce soltanto `runtime_capabilities` e non le integrazioni o la loro
salute.

## 3. Matrice dei servizi

Legenda origine autorevole: **D** deployment, **S** secret, **R** runtime,
**X** derivata. `Disabled` è uno stato normale solo per capability dichiarate
opzionali.

### 3.1 Persistenza

| Voce | PostgreSQL | SQLite |
| --- | --- | --- |
| 1. Provider | `postgres` implementato | `sqlite` implementato |
| 2. Endpoint/porta/schema | URI/host, porta, database, TLS e schema search path; D | path file o `:memory:`; D |
| 3. Capability | obbligatoria; esattamente un provider | obbligatoria; esattamente un provider |
| 4. Timeout/retry/limiti | connect/query timeout, pool min/max, idle/lifetime, retry solo bootstrap esplicito; oggi non catalogati | busy timeout, journaling/sync policy, dimensione/permessi file; parte interna, non catalogata |
| 5. Healthcheck/stato | `SELECT 1` implementato; aggiungere readiness migrazioni, ruolo ristretto e pool | `SELECT 1` implementato; aggiungere path scrivibile, schema version e spazio disco |
| 6. Dipendenze | rete, server PostgreSQL, migrazioni, credenziale applicativa | filesystem locale persistente e lock OS |
| 7. Reload | riavvio obbligatorio | riavvio obbligatorio |
| 8. Fonte | `DATABASE_ADAPTER`, `DATABASE_URL`, policy ruolo; D | `DATABASE_ADAPTER`, `SQLITE_DATABASE_PATH`; D |
| 9. Secret | password/certificati via riferimenti S; URI sanitizzata | cifratura disco/permessi esterni; nessun secret DB applicativo corrente |
| 10. Auth/audit | Admin sola lettura sanitaria; cambi provider fuori app e audit deployment | idem |
| 11. Fallback | nessuno: avvio fallisce chiaramente | nessuno; path predefinito ammesso solo nel profilo standalone dichiarato |
| 12. Parità | contratto comune, più semantiche native PostgreSQL | stesso risultato osservabile; differenze fisiche documentate |
| 13. Test | parsing TLS/URI, pool, restricted role, migrazione empty/upgrade, health e failure | path/default/permessi, busy/rollback, schema bootstrap, contract/parity/E2E |

### 3.2 Realtime e worker outbox

| Voce | Proposta |
| --- | --- |
| 1. Provider | `disabled`, `pusher-compatible` (Soketi self-hosted o Pusher gestito); il marchio del deployment non cambia il protocollo |
| 2. Endpoint/porta/schema | endpoint interno server e pubblico browser distinti; HTTP(S)/WS(S), porta, app id/key, cluster; D |
| 3. Capability | `optional`; disponibilità D + policy R. Stato effettivo = disponibile AND abilitato |
| 4. Timeout/retry/limiti | connect/publish timeout, drain batch, claim TTL, retry/backoff/max attempts e backlog alert; evitare timer duplicati |
| 5. Healthcheck/stato | readiness provider, pubblicazione sintetica opzionale, worker last-seen, backlog/oldest event; stati `disabled/not-configured/healthy/degraded/unhealthy` |
| 6. Dipendenze | persistenza/outbox sempre; provider e worker solo se attivo; endpoint browser coerente con origine pubblica |
| 7. Reload | policy R hot; endpoint/credenziali e config browser richiedono riavvio, e oggi rebuild per `NEXT_PUBLIC_*` |
| 8. Fonte | provider/endpoints D; secret S; enabled e limiti ammessi R; intervalli derivabili X |
| 9. Secret | app secret e worker secret S; app key pubblica non segreta; mai restituire secret/reference al client |
| 10. Auth/audit | `system.config.read` per stato; `system.config`/permesso dedicato per policy; audit enable/disable e drain amministrativo |
| 11. Fallback | disabilitato: nessuna sottoscrizione/pubblicazione, mutazioni e cache funzionano tramite HTTP/polling autorizzato; outbox non deve crescere inutilmente |
| 12. Parità | PostgreSQL completo; SQLite deve mantenere flussi comuni senza realtime e può testare outbox localmente |
| 13. Test | resolver internal/public/TLS, disabled end-to-end, retry/idempotenza/backlog, auth worker, health redatto, browser senza env realtime, PostgreSQL claim concorrenti |

Problema corrente del caso disabilitato: `NEXT_PUBLIC_REALTIME_ENABLED`,
capability `realtime`, presenza della config Pusher e adapter server-side possono
divergire. Il piano deve introdurre un solo `EffectiveCapabilityState` e impedire
worker/pubblicazione/sottoscrizione quando non effettivamente attivo.

### 3.3 Antivirus

| Voce | Proposta |
| --- | --- |
| 1. Provider | `disabled`, `clamav` |
| 2. Endpoint/porta/schema | TCP host/porta; eventuale TLS solo tramite adapter/proxy esplicito; D |
| 3. Capability | opzionale; policy scansione R vincolata alla disponibilità D |
| 4. Timeout/retry/limiti | scan timeout, max stream size coerente con upload, nessun retry cieco dello stesso payload; concorrenza/circuit breaker futuri solo su caso provato |
| 5. Healthcheck/stato | PING/PONG implementato; aggiungere versione firme/ultima verifica ove disponibile e redazione errori |
| 6. Dipendenze | upload/storage policy; il file non deve essere persistito definitivamente prima dell'esito richiesto |
| 7. Reload | policy `enabled/failClosed` hot; endpoint e adapter al riavvio |
| 8. Fonte | host/porta/timeout massimo D; `attachments.antivirusEnabled` e fallback R; limiti upload da policy autorevole |
| 9. Secret | normalmente nessuno; eventuale tunnel/certificati S/D |
| 10. Auth/audit | modulo Content → Attachment protection; modifica auditata e permessi config; stato leggibile solo autorizzato |
| 11. Fallback | disabled: nessuna scansione; unavailable + fail-closed: 503; unavailable + best-effort solo se esplicitamente consentito e audit/metriche |
| 12. Parità | identica policy applicativa; SQLite standalone default disabled |
| 13. Test | clean/infected/timeout/protocol error/oversize, matrix enabled×configured×failClosed, nessun file orfano, contract su entrambi gli adapter, E2E disabled e unavailable |

Problema corrente: `attachments.antivirusEnabled`, `requireScan` deployment e
presenza dello scanner non sono composti in un unico stato. La route upload può
fallire in modo non intuitivo se la policy richiede scansione ma l'adapter manca.

### 3.4 Storage allegati

| Voce | Proposta |
| --- | --- |
| 1. Provider | `filesystem` (locale o mount/volume remoto), `s3-compatible`; nessun `disabled` se gli allegati sono usati, ma capability allegati eventualmente separata e futura |
| 2. Endpoint/porta/schema | filesystem: path assoluto; S3: HTTPS endpoint, regione, bucket, prefix, path/virtual-host style; D |
| 3. Capability | provider obbligatorio per campi file; disponibilità esplicita. Mount remoto resta provider filesystem, non provider Docker |
| 4. Timeout/retry/limiti | IO/request timeout, retry idempotenti, multipart thresholds, quota globale/per file/per utente; checksum obbligatorio |
| 5. Healthcheck/stato | filesystem mkdir/read-write-delete probe sicuro e spazio; S3 HeadBucket/put-get-delete probe configurabile; mai mostrare path completo non autorizzato |
| 6. Dipendenze | metadata DB, chiavi cifratura, antivirus e backup coordinato |
| 7. Reload | provider/path/endpoint/chiavi al riavvio; quota/policy runtime hot; rotazione chiavi tramite job |
| 8. Fonte | provider/path/bucket/endpoint D; credenziali S; cifratura funzionale e quota R; storage key/checksum X |
| 9. Secret | access/secret/session token e chiavi cifratura S; IAM/workload identity preferibile |
| 10. Auth/audit | Content → Attachment protection mostra stato/policy; topologia sola lettura; upload/delete/purge già autorizzati e auditati |
| 11. Fallback | nessun cambio automatico fra provider; se assente, upload non disponibile con stato normale, letture esistenti non devono mentire |
| 12. Parità | stesso port e semantica indipendenti dal DB; backup metadata+payload coordinato su entrambi |
| 13. Test | path traversal, atomicità/cleanup, checksum/cifratura/rotazione, mount error, S3 fake ufficiale/contract, quota/rollback, purge, backup-restore coordinato, E2E upload/download |

Il provider S3 è rinviato. Non va registrato o selezionabile finché adapter,
healthcheck, cleanup transazionale e contract test non sono presenti.

### 3.5 Email e notifiche account

| Voce | Proposta |
| --- | --- |
| 1. Provider | `disabled`, `webhook` (esistente), `smtp`; altri provider API solo su richiesta concreta |
| 2. Endpoint/porta/schema | webhook HTTPS + public base URL; SMTP host/porta e `plain/starttls/tls`; D |
| 3. Capability | opzionale per login esistente, richiesta per inviti/reset self-service; readiness del flusso deve dichiararlo |
| 4. Timeout/retry/limiti | connect/request timeout, retry con backoff solo su errori temporanei, max attempts, rate limit e idempotency key |
| 5. Healthcheck/stato | webhook probe non distruttiva/config validation; SMTP connect/EHLO/STARTTLS senza invio; delivery backlog e ultimo esito |
| 6. Dipendenze | token account, URL pubblico corretto, template/localizzazione, eventuale outbox dedicata |
| 7. Reload | policy R hot; provider/endpoints/credenziali al riavvio |
| 8. Fonte | provider/endpoints/from/public URL D; password/token S; limiti/policy R |
| 9. Secret | webhook bearer, SMTP password/API key S; username può essere sensibile e va redatto |
| 10. Auth/audit | Platform → Integrations; test email come azione privilegiata, rate-limited e auditata senza token/indirizzo completo nei log |
| 11. Fallback | disabled: amministrazione utenti ancora possibile, ma operazioni che richiedono consegna ritornano errore semantico `DELIVERY_NOT_CONFIGURED`, non 500 |
| 12. Parità | indipendente dal DB; token e audit devono essere transazionalmente equivalenti PostgreSQL/SQLite |
| 13. Test | URL/token redaction, SMTP TLS modes, webhook timeout/status, retry/idempotenza, disabled flow, token non perso, contract token DB e E2E invito/reset con fake provider |

Problema corrente: l'assenza di `AccountActionDeliveryPort` è tollerata dal
service, ma non esiste un catalogo di stato né un errore operativo uniforme;
il webhook usa `fetch` senza timeout o retry.

### 3.6 Osservabilità e metriche

| Voce | Proposta |
| --- | --- |
| 1. Provider | `disabled`, endpoint Prometheus pull; OTLP/log exporter solo se già richiesto da un deployment futuro |
| 2. Endpoint/porta/schema | bind interno delle metriche e/o exporter HTTPS; target scraper è proprietà dell'infrastruttura, non dell'app |
| 3. Capability | opzionale; metriche interne possono restare registrate anche senza exporter |
| 4. Timeout/retry/limiti | exporter timeout/queue/batch; cardinalità e retention sono limiti deployment, non setting utente ordinario |
| 5. Healthcheck/stato | endpoint self-check, exporter last success/drop count; Prometheus stesso è esterno e non requisito di readiness app |
| 6. Dipendenze | autenticazione endpoint, redazione dati, alert manager esterno |
| 7. Reload | log level eventualmente hot; exporter/endpoint al riavvio |
| 8. Fonte | endpoint/provider D; credential S; log level/soglie R solo se policy consente; aggregati X |
| 9. Secret | scrape/export token separato dal worker secret; mai riusare `REALTIME_WORKER_SECRET` |
| 10. Auth/audit | Platform → Health & observability; metriche tecniche protette; modifica soglie auditata |
| 11. Fallback | disabled/exporter down non interrompe flussi applicativi; segnala degradazione e buffer bounded |
| 12. Parità | metriche comuni con label adapter; nessuna differenza funzionale utente |
| 13. Test | auth/redaction/cardinalità, disabled, exporter timeout, bounded queue, endpoint metrics, Compose e deployment remoto |

### 3.7 Backup e restore

| Voce | Proposta |
| --- | --- |
| 1. Provider | PostgreSQL: `postgres-dump` esistente; SQLite: `sqlite-snapshot` da progettare; destinazione filesystem/mount, con object storage demandato all'infrastruttura o adapter approvato |
| 2. Endpoint/porta/schema | source DB e destination path/bucket D; restore target sempre input operativo esplicito e test-only per verifica automatica |
| 3. Capability | obbligatoria per release candidate/prod, opzionale nello sviluppo; restore mai azione runtime ordinaria |
| 4. Timeout/retry/limiti | schedule, retention, max age/RPO, spazio minimo, timeout dump/verify/upload; retry scheduler esterno |
| 5. Healthcheck/stato | ultimo backup verificato, età, checksum, restore test, copia off-host e payload allegati; oggi status JSON solo PostgreSQL |
| 6. Dipendenze | credenziali amministrative separate, storage backup, schema/migrazioni, allegati e secret/keyring coordinati |
| 7. Reload | schedule/destinazione deployment; nessun hot reload richiesto all'app; restore con maintenance window |
| 8. Fonte | provider/schedule/path/retention D; stato X da artefatto firmato/sanitizzato; nessun comando distruttivo dal DB runtime |
| 9. Secret | dump trattato come secret; DB admin e object storage S; cifratura e accesso minimo |
| 10. Auth/audit | Admin sola lettura dello stato; avvio restore fuori pannello, autorizzazione operativa a due passi e log immutabile |
| 11. Fallback | backup assente/stale rende readiness operativa degradata, non rompe richieste; una release prod non è pronta |
| 12. Parità | entrambe le persistenze devono avere backup verificabile di DB+allegati; formato può differire, risultato di recovery no |
| 13. Test | PostgreSQL empty/upgrade/dump/checksum/restore/counts; SQLite online-safe snapshot/integrity/restore; corruzione, spazio, retention, stale status, allegati/keyring, drill E2E canonico post-restore |

### 3.8 Autenticazione, secret e servizi previsti

| Voce | Proposta |
| --- | --- |
| 1. Provider | autenticazione locale/sessione esistente; `disabled` non ammesso. OIDC/SAML non vanno aggiunti senza requisito; secret provider `environment/file/manager` è infrastrutturale |
| 2. Endpoint/porta/schema | application public URL e callback D; eventuale IdP futuro D |
| 3. Capability | account recovery/MFA possono essere optional; autenticazione base richiesta |
| 4. Timeout/retry/limiti | session idle R; token/rate limit R catalogati; heartbeat/lock TTL/polling X; provider auth futuro con timeout D |
| 5. Healthcheck/stato | signing secret presente, public URL valido, MFA key readiness, delivery readiness; nessuna esposizione di valori |
| 6. Dipendenze | DB, hashing password, session store; MFA key e mail per flussi specifici |
| 7. Reload | session policy deve diventare hot; signing/encryption keys e provider al riavvio con procedura di rotazione |
| 8. Fonte | `NEXTAUTH_SECRET`, URL, encryption keyring D/S; session e policy account R; timer X |
| 9. Secret | firma sessione, MFA e keyring S; riferimenti e versioni sanitizzate soltanto |
| 10. Auth/audit | security readiness superadmin/read-only; policy mutate con permesso dedicato e audit |
| 11. Fallback | chiave obbligatoria mancante: fail fast; MFA non configurata: enrollment indisponibile; mail assente: recovery/invito esplicitamente indisponibili |
| 12. Parità | sessioni, token, rate limit, MFA e audit equivalenti PostgreSQL/SQLite |
| 13. Test | bootstrap missing secret, rotation, session activity/inactivity/background/network/two sessions, MFA disabled, mail missing, contract DB ed E2E |

## 4. Cataloghi proposti

### 4.1 Catalogo minimo per la verticale canonica

Questo è il solo catalogo P0/P1 da implementare prima di nuovi provider:

1. persistenza `postgres|sqlite`, obbligatoria e deployment-only;
2. realtime `disabled|pusher-compatible`, con stato effettivo unificato e
   fallback non-realtime;
3. antivirus `disabled|clamav`, con policy unica e fail-closed esplicito;
4. storage `filesystem`, valido sia per directory locale sia mount remoto;
5. mail `disabled|webhook`, per rendere deterministico il flusso account già
   esistente;
6. backup `postgres-dump|sqlite-snapshot`, stato sola lettura e restore drill;
7. osservabilità `disabled|prometheus-pull`, credenziale separata;
8. security readiness: session secret, field/attachment/MFA keyring e URL
   pubblico, senza valori;
9. policy runtime esistenti: session idle, cifratura campi/allegati, antivirus,
   audit lock lifecycle e realtime, ciascuna con una sola fonte autorevole.

S3 e SMTP non sono necessari a chiudere la verticale canonica: vanno preparati
nel contratto ma implementati dopo che filesystem/webhook e stati disabled sono
solidi.

### 4.2 Catalogo completo supportabile

| Famiglia | Provider ammessi a catalogo | Fase |
| --- | --- | --- |
| Persistence | PostgreSQL, SQLite | minimo |
| Realtime | disabled, Pusher-compatible (Soketi/Pusher) | minimo |
| Antivirus | disabled, ClamAV | minimo |
| Attachment storage | filesystem/mount, S3-compatible | filesystem minimo; S3 successivo |
| Mail | disabled, webhook, SMTP | webhook minimo; SMTP successivo |
| Observability | disabled, Prometheus pull; OTLP solo su requisito | Prometheus minimo |
| Backup | postgres-dump, sqlite-snapshot; destinazione remota tramite mount/adapter approvato | minimo |
| Authentication | local; OIDC/SAML solo futura decisione esplicita | local |
| Secret resolution | environment, file protetto, orchestrator/secret manager | contratto; nessuna UI valori |
| Proxy/public ingress | esterno all'app (Caddy/Nginx/LB/provider) | readiness sola lettura |
| Workers | in-process/HTTP drain scheduler esterno | normalizzare nel minimo |

## 5. Tassonomia Admin

Conservare `AdminModuleRegistry` come unica gerarchia eseguibile:

- **Platform → Runtime capabilities**: policy enabled/disabled/required con
  spiegazione delle dipendenze; non provider/endpoints editabili;
- **Platform → Integrations**: schede sola lettura per realtime, antivirus,
  storage e mail con provider sanitizzato, stato, ultima verifica, fallback e
  badge `restart required`; azioni consentite: refresh health e test non
  distruttivo auditato;
- **Platform → Data & recovery**: persistenza, migrazioni, backup e restore
  readiness; restore soltanto procedura/link operativa, mai pulsante diretto;
- **Platform → Health & observability**: salute aggregata e dipendenze, metriche
  ed exporter; nessun secret o target sensibile per utenti non autorizzati;
- **Platform → Session security**: setting runtime della sessione e valori
  derivati mostrati read-only;
- **Content → Attachment protection**: policy cifratura/scansione/fallback e
  disponibilità storage/scanner contestuale;
- **Model → Field protection** e **Governance → Audit recording** restano dove
  sono;
- **Other settings** continua a mostrare solo chiavi non classificate.

Ogni catalogo usa etichette localizzate, descrizioni e fallback per provider
storici/sconosciuti. Le chiavi tecniche sono dettagli avanzati copiabili, mai
input testuale ordinario. Stati vuoto/loading/error/forbidden/disabled sono
contratti separati.

## 6. Contratti applicativi e port

### 6.1 Evolvere i contratti esistenti

`ServiceConfigurationRegistry` deve aggiungere, senza valori concreti:

- `requirement: required|optional` e provider esplicito `disabled` dove valido;
- schema dei campi con default, enum, unità, min/max, formato URI/path e
  sensibilità di visualizzazione;
- `reload: hot|process-restart|rebuild|redeploy`;
- dipendenze dichiarate e fallback supportati;
- descrittori di timeout/retry/limiti e healthcheck;
- versione del contratto per migrazioni additive.

`ServiceConfigurationService` deve produrre:

- `DeploymentAvailability` (configured/supported/misconfigured);
- `EffectiveServiceState` (required/disabled/healthy/degraded/unhealthy);
- `PublicServiceDescriptor` sanitizzato con provenienza e lifecycle, senza
  reference secret;
- validazione cross-field e cross-service;
- precedenza invariabile: provider D autorevole, policy R solo sui campi runtime
  dello stesso provider, X calcolato; una riga runtime non sceglie il provider.

### 6.2 Port necessari

| Port | Layer/responsabilità | Note |
| --- | --- | --- |
| `ServiceDeploymentConfigurationSource` | Application port già presente | estendere con snapshot/versione e `getAll`; implementazioni env/file/orchestrator fuori dal Domain |
| `SecretReferenceResolver` | già presente | supportare schemi registrati senza esporre valori; rotazione resta deployment |
| `ServiceConfigurationRepository` | già presente | solo valori R, CAS, audit via application service; contract condiviso |
| `ServiceHealthCheckPort/Registry` | già presente | timeout policy, stato degraded, error code sanitizzato, dipendenze e last check |
| `ServiceAdministrationApplicationService` | nuovo use case | autorizzazione, lista pubblica, update runtime CAS, audit e health refresh; nessun SQL/framework |
| `EffectiveCapabilityResolver` | nuovo port/service applicativo | unifica disponibilità D, policy R e requisito; usato da consumer e Admin |
| `AttachmentStoragePort` | già presente | adapter S3 futuro e health probe separato; non contaminare il port CRUD con UI |
| `AttachmentScannerPort` | già presente | costruzione provider e policy fuori dalla route |
| `AccountActionDeliveryPort` | già presente | adapter disabled/webhook/SMTP; aggiungere semantica errore e, se necessario, outbox/idempotenza |
| `BackupStatusPort` | nuovo, read-only | espone manifest sanitizzato; esecuzione/restore restano strumenti operativi |
| `BackupProvider` | nuovo solo per SQLite snapshot o se serve orchestrare backup dall'app | evitare framework universale; inizialmente CLI/adapters operativi |
| `ObservabilityPort` | introdurre solo per metriche applicative comuni | exporter è Infrastructure; health separato |
| `PublicRuntimeConfigurationPort` | consolidare contratto session/browser | consegna session timing runtime senza build arg e senza estendere sessione passivamente |

Ogni nuovo componente dovrà dichiarare bounded context Administration o
Governance, layer, dipendenze consentite/vietate, fase transazionale e side
effect post-commit. L'update runtime deve essere: autorizzazione → validazione →
transazione CAS + audit → commit → invalidazione config/realtime, mai healthcheck
esterno dentro la transazione.

## 7. Ordine minimo degli interventi

1. **Baseline e inventario eseguibile**: rendere verde/riproducibile l'E2E parity
   corrente; aggiungere test che confronta registry, resolver, env documentate e
   consumer senza cambiare provider.
2. **Contratto di stato e disabled**: introdurre provider/requirement/lifecycle,
   precedenza D→R→X ed `EffectiveCapabilityResolver`; eliminare le fonti duplicate
   per realtime e antivirus mediante migrazione compatibile.
3. **Read model Admin e sicurezza**: use case autorizzato/auditato, DTO
   sanitizzati, errori semantici e healthcheck con codici; nessuna UI di scrittura
   per deployment/secret.
4. **Verticale minima provider esistenti**: completata per persistence,
   filesystem, ClamAV, Pusher-compatible, webhook, Prometheus e security
   readiness. I consumer runtime di realtime e antivirus consultano lo stato
   effettivo; client realtime e fallback HTTP restano coerenti quando disabilitati.
5. **Backup parity**: formalizzare manifest/status PostgreSQL, aggiungere snapshot
   e restore verificato SQLite, includere allegati e keyring nel runbook.
6. **Admin IA**: aggiungere Integrations, Data & recovery, Health & observability
   con stati disabled/unavailable e test workspace; mantenere le route sottili.
7. **Provider completi differiti**: S3-compatible e SMTP, uno alla volta con
   adapter, healthcheck, contract, failure semantics e documentazione; nessun
   provider ulteriore senza caso d'uso approvato.
8. **Compose come esempio**: rendere opzionali profili realtime/antivirus/
   monitoring/backup, rimuovere dipendenze obbligatorie del Web e documentare
   equivalenti remoti/non-Docker.

Non introdurre hot swap di database/storage, un orchestratore universale o
configurazione completa dei secret dal pannello: sono fuori perimetro e
aumenterebbero il rischio senza servire la verticale.

## 8. Strategia di migrazione dati e compatibilità

- migrazioni additive per metadata/versione; nessuna cancellazione iniziale di
  `service_configurations` o `system_settings`;
- script/read model di riconciliazione che segnala provider runtime storico
  diverso dal deployment, senza applicarlo;
- scegliere una sola chiave per ogni policy: mantenere alias di lettura
  temporanei, migrare valori con CAS/versione e poi deprecare l'alias;
- capability `realtime` esistente mantenuta come policy autorevole oppure
  migrata a una nuova chiave, ma non duplicata con `realtime.enabled`;
- `attachments.antivirusEnabled` resta candidata autorevole; `requireScan`
  diventa vincolo deployment (`required`) e non secondo toggle;
- nessun segreto migra nel database. Eventuali valori già presenti devono
  causare redazione/errore e procedura operativa di rimozione;
- migrazione SQLite equivalente nello schema bootstrap e percorso di upgrade
  reale; PostgreSQL su schema vuoto, fixture precedente e reapply idempotente.

## 9. Piano di test

### Unitari

- schema registry: duplicati, provider disabled, required, formati, min/max,
  lifecycle, dipendenze e impossibilità di campi secret client-visible;
- resolver: precedenza D/R/X, config storica incoerente, missing required,
  optional disabled, secret resolution/redaction, cross-field validation;
- effective capability truth table per tutti i servizi opzionali;
- health aggregator: healthy/degraded/unhealthy/disabled/not-configured,
  timeout, sanitizzazione e dipendenze;
- consumer: realtime, upload/scanner, delivery, session timing e storage non
  leggono direttamente env o toggle paralleli.

### Contract condivisi PostgreSQL/SQLite

- `ServiceConfigurationRepository`: get/upsert/CAS conflict/rollback/order e
  JSON valido;
- configurazione+audit atomici e invalidazione post-commit;
- autorizzazione read/update/health e assenza di disclosure;
- session, lock, attachment policy, token account e outbox con provider disabled;
- migrazione/seed idempotenti e stessi default osservabili.

### Integrazione PostgreSQL

- database dedicato con `test` nel nome; restricted role;
- schema vuoto, upgrade, reapply; pool/health/migration readiness;
- claim concorrenti outbox, retry e backlog;
- backup custom/checksum/restore temporaneo e manifest sanitario;
- storage/ClamAV/Pusher/mail con test service isolati o fake ufficiali, mai
  credenziali operative.

### SQLite

- standalone senza servizi esterni: avvio, login, allegati filesystem, mail/
  realtime/antivirus disabled senza errori client;
- busy timeout, transazioni/CAS e restart sullo stesso file;
- snapshot consistente, `integrity_check`, restore in file temporaneo e
  riapertura dell'app;
- parità del catalogo pubblico, degli errori e dell'audit.

### E2E

- `e2e:canonical` PostgreSQL completo e SQLite standalone;
- `e2e:parity` su tutte le funzioni comuni, prima reso verde sulla baseline;
- Admin: mapping etichetta→chiave, loading/empty/error/forbidden/disabled,
  provider storico sconosciuto, refresh health, bozza/filtro conservati,
  restart badge e nessun secret nel DOM/network;
- scenario due sessioni/lock/realtime attivo e stesso scenario senza realtime;
- upload con antivirus disabled, clean, infected e unavailable fail-closed;
- invito/reset con mail disabled (errore semantico) e fake provider;
- smoke post-restore della verticale canonica e verifica audit/scope/allegati.

### Operativi e CI

- matrice CI: check/build SQLite, PostgreSQL integration/contract, parity browser,
  canonical profiles e backup/restore per entrambi;
- Compose completo e deployment non-Docker con endpoint remoti simulati;
- `git diff --check`, `pnpm check`, build production Web e nessuna variabile
  documentata non classificata;
- test statico che impedisce `process.env` nei provider/consumer fuori dalla
  sorgente deployment e dai boundary esplicitamente ammessi.

## 10. Aggiornamenti documentali richiesti durante l'implementazione

- `ARCHITECTURE.md`: aggiungere solo i nuovi port/responsabilità realmente
  introdotti e la sequenza transazione/post-commit;
- `docs/RUNTIME_CONFIGURATION_CATALOG.md`: catalogo completo chiave per chiave,
  tipo/default/range/source/reload/visibility/audit/derivati;
- `docs/SERVICE_CONFIGURATION_ARCHITECTURE.md`: stato effettivo, provider
  supportati versus descrittivi, resolver e diagramma D/R/S/X;
- `docs/ADMIN_INFORMATION_ARCHITECTURE.md`: nuovi moduli, route, permessi e stati
  optional/disabled;
- `docs/DOCKER_COMPOSE_FULL.md`: Compose esempio, profili opzionali e mapping a
  servizi remoti;
- `docs/SECRET_MANAGEMENT.md` e `docs/SECURITY_OPERATIONS.md`: schemi di
  riferimento, redazione, rotazione e separazione token metriche/worker;
- `docs/BACKUP_RESTORE.md`, `docs/BACKUP_OPERATIONS.md` e
  `docs/OPERATIONS_READINESS.md`: SQLite, allegati, manifest/status e drill;
- `docs/REALTIME_MUTATION_LIFECYCLE.md`,
  `docs/HUMAN_ACTIVITY_SESSION_LOCKS.md` e
  `docs/RESOURCE_METADATA_FORMS.md`: fonti autorevoli e comportamento disabled;
- `.env` example e documentazione di ogni variabile, senza valori reali;
- release checklist e note di migrazione con compatibilità, deprecazioni e
  rollback.

## 11. Criteri di accettazione del programma

Il lavoro sarà completo quando:

1. ogni servizio ha provider/stato/fonte/reload/fallback univoci e validati;
2. nessun secret o riferimento interno sensibile raggiunge client, log o audit;
3. Admin distingue policy modificabile, deployment sola lettura e valore
   derivato, con autorizzazione backend e CAS;
4. tutti i servizi opzionali disabilitati permettono allo standalone SQLite di
   completare la verticale comune senza 500 o errori client;
5. PostgreSQL completo esercita realtime, antivirus, osservabilità e backup;
6. filesystem e webhook esistenti sono consolidati prima di S3 e SMTP;
7. backup/restore verificato copre PostgreSQL, SQLite, allegati e disponibilità
   delle chiavi;
8. `pnpm check`, integrazioni PostgreSQL, contract/parità, E2E canonico e parity,
   migrazioni e backup/restore sono verdi in ambiente isolato;
9. Docker Compose può essere sostituito da endpoint/provider remoti senza
   modificare Domain o Application;
10. i documenti normativi descrivono esattamente lo stato implementato, non
    provider soltanto aspirazionali.

## 12. Decisioni da approvare prima dell'implementazione

1. confermare il catalogo minimo e il rinvio di S3/SMTP alla fase successiva;
2. confermare che provider/topologia restino deployment-only e che Admin mostri
   soltanto stato sanitizzato e policy runtime;
3. scegliere la chiave autorevole unica per realtime e la semantica
   `required|optional|disabled`;
4. approvare `attachments.antivirusEnabled` come toggle runtime e
   `requireScan` come vincolo deployment fail-closed;
5. approvare l'introduzione di backup SQLite verificato e del manifest di stato
   read-only;
6. decidere se il webhook mail resta nel catalogo pubblico stabile o è un
   adapter transitorio prima di SMTP;
7. approvare la tassonomia Admin e i relativi nuovi permessi, evitando un
   generico editor tecnico delle integrazioni.
