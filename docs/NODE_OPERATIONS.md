# Operatività Node.js: avvio, aggiornamenti e diagnosi

Runbook di riferimento per installazioni senza Docker, SQLite o PostgreSQL.
La configurazione del sistema operativo e del gestore dei processi resta fuori
dal perimetro di Nodriva. Completare prima [INSTALLATION.md](INSTALLATION.md) e
[FIRST_RUN.md](FIRST_RUN.md).
Per Docker usare [DOCKER_COMPOSE_FULL.md](DOCKER_COMPOSE_FULL.md).

## Requisiti del processo applicativo

Il processo Web richiede Node.js 24, una release costruita con asset e dipendenze
standalone e le variabili descritte in [INSTALLATION.md](INSTALLATION.md).
`HOSTNAME` e `PORT` determinano indirizzo e porta di ascolto; l'esempio locale
usa `127.0.0.1:3000`. L'avvio del Web non avvia database esterni, proxy o worker.

Database SQLite e allegati devono risiedere su percorsi assoluti persistenti e
scrivibili dal processo; i secret devono essere accessibili solo ai soggetti
autorizzati. Per SQLite conservare database e file ausiliari nella stessa
directory e non condividere lo stesso file tra più repliche Web. Non sostituire
chiavi di cifratura già utilizzate. I log possono contenere metadati applicativi:
non pubblicarli integralmente.

Avvio automatico, riavvio del processo e raccolta dei log sono responsabilità
del deployment. Questa guida ne descrive i requisiti applicativi, non la
configurazione del sistema operativo.

## Proxy, HTTPS e integrazioni

Configurare il proxy scelto per inoltrare all'indirizzo del Web, preservare
l'host pubblico e comunicare lo schema HTTPS originale. `NEXTAUTH_URL` deve
coincidere con l'origine pubblica effettiva, non con l'indirizzo del backend.
Consentire accesso diretto al backend solo dagli ingressi autorizzati. Per una
prova locale non esporre la porta su tutte le interfacce.

Verificare certificato, redirect, login, cookie e richieste applicative attraverso
il proxy. Se abilitato, il realtime richiede anche la corretta pubblicazione
dell'endpoint WebSocket e un worker autenticato; il solo broker non basta.
Consultare [REALTIME_MUTATION_LIFECYCLE.md](REALTIME_MUTATION_LIFECYCLE.md) e
[SERVICE_CONFIGURATION_ARCHITECTURE.md](SERVICE_CONFIGURATION_ARCHITECTURE.md).
Non considerare un provider disponibile solo perché il processo è in esecuzione.

## Aggiornamento controllato

1. Annotare versione/commit, configurazione e integrazioni correnti. Leggere le
   note della nuova release, incluse migrazioni e compatibilità dei formati.
2. Costruire la nuova release in una directory separata, con dipendenze dal
   lockfile e build Core prima del Web. Usare secret e database di build isolati;
   i `NEXT_PUBLIC_*` devono però corrispondere alla configurazione pubblica del
   deployment perché sono incorporati nella build. Non compilare sopra il
   bundle servito dal processo attivo e non distribuire file `.env` di test.
3. Verificare in ambiente isolato secondo [RELEASE_CHECKLIST.md](RELEASE_CHECKLIST.md).
4. Concordare la manutenzione e fermare Web e worker che scrivono dati. Creare
   un backup coordinato di database, allegati e chiavi e verificarne il restore.
   Non copiare a caldo il solo file SQLite: usare gli strumenti di snapshot
   documentati in [BACKUP_RESTORE.md](BACKUP_RESTORE.md).
5. Per PostgreSQL applicare, con identità amministrativa separata, le migrazioni
   mancanti in ordine di nome, registrando quelle applicate e i relativi esiti.
   **Non riapplicare lo schema base** durante l'upgrade. Il progetto distribuisce
   SQL ordinato, non un comando universale di rollback dello schema. Consultare
   [db/README.md](../db/README.md). Per SQLite le evoluzioni sono eseguite
   dall'inizializzazione dell'adapter: fare il backup prima del nuovo avvio.
6. Se richiesto dalla release, rieseguire il bootstrap additivo. Non interpretare
   questa operazione come reset dei dati o delle password.
7. Selezionare la nuova directory di release nel service manager o nel collegamento
   gestito dall'operatore. Conservare la precedente; avviare solo i servizi
   interessati, con l'ambiente operativo corretto.
8. Verificare HTTP, login, scope, allegati, audit e integrazioni; controllare i log
   e la persistenza dopo riavvio. Annotare esiti, durata e versione distribuita.

In Compose mantenere la stessa selezione di overlay e ricostruire/ricreare solo i servizi
toccati, senza `down --volumes` o ricostruzioni globali non necessarie.

## Rollback

Se dati, schema e formati restano compatibili, selezionare il bundle precedente,
riavviare i servizi interessati e ripetere gli smoke test. Non limitarsi a fare
checkout del codice mentre il server usa ancora un'altra build.

Se la release ha cambiato schema o formato dei payload, il rollback del solo
codice può essere insufficiente. Ripristinare prima in un ambiente isolato lo
snapshot coordinato con le chiavi corrette e provarlo con la vecchia release.
Un restore operativo sostituisce lo stato corrente e può perdere modifiche
successive al backup: richiede autorizzazione esplicita e finestra concordata.
Non generare nuove chiavi per tentare di leggere vecchi dati cifrati.

## Diagnosi rapida

| Sintomo | Controllo e intervento sicuro |
| --- | --- |
| Import `@dashboard/core` o `dist/index.js` non trovato | Dalla root eseguire installazione con lockfile e build Core prima del Web. Non copiare file compilati da una release diversa. |
| SQLite non si apre / `EACCES` | Controllare percorso assoluto, directory esistente, proprietario e permessi dell'account Web; non creare un secondo database per nascondere l'errore. |
| Pagina senza stile o asset 404 | Controllare che `public` e `.next/static` siano stati copiati nel bundle standalone della stessa build. |
| Primo login PostgreSQL impossibile | Verificare migrazioni, ruolo ristretto e bootstrap esplicito; le sole variabili `SEED_ADMIN_*` nel Web non creano l'account. |
| Password seed nuova non funziona | Il seed non aggiorna un account esistente. Usare password corrente o recupero configurato, non reset del database. |
| Connessione PostgreSQL/TLS fallisce | Verificare DNS, rete, password percent-encoded, database e CA attendibile. Non usare superuser o disabilitare TLS come rimedio. |
| Login in loop dietro proxy | Confrontare origine pubblica, `NEXTAUTH_URL`, schema inoltrato, HTTPS e cookie; verificare che tutte le repliche abbiano secret coerenti. |
| Liste vuote o accesso negato | Su installazione nuova è atteso; altrimenti verificare ruolo, scope e stato delle risorse con un amministratore. Non ampliare automaticamente i permessi. |
| Allegati non leggibili | Verificare mount, metadata, formato e tutte le versioni del keyring. Confrontare checksum su copie; nessuna conversione/cancellazione automatica dei file storici. |
| Realtime assente | Verificare capability, configurazione incorporata nella build, broker, worker e WebSocket. Senza configurazione la disabilitazione è intenzionale. |
| Inviti o recupero non consegnati | Verificare provider di delivery, secret, endpoint e gestione outbox. La sola configurazione SMTP esterna non viene scoperta automaticamente. |
| Backup non disponibile nel pannello | Verificare scheduler e `last-status.json` leggibile dal Web; controllare età ed esito restore, non solo presenza del dump. |

Se un controllo fallisce, conservare l'errore depurato da credenziali e contenuti
sensibili. Distinguere dinieghi applicativi da guasti infrastrutturali; non
disattivare autorizzazioni, lock, versioni o cifratura per aggirare il problema.
