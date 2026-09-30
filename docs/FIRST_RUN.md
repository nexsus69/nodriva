# Primo accesso e configurazione iniziale

Questa guida segue [INSTALLATION.md](INSTALLATION.md). Vale per PostgreSQL e
SQLite; non richiede il caricamento del dominio demo né servizi opzionali.
Le etichette possono cambiare con la lingua: le aree canoniche sono descritte
in [ADMIN_INFORMATION_ARCHITECTURE.md](ADMIN_INFORMATION_ARCHITECTURE.md).

## 1. Verificare l'ambiente vuoto

Accedere a `/login` con l'identità configurata in `SEED_ADMIN_EMAIL` e
`SEED_ADMIN_PASSWORD`. Su una nuova installazione non ci sono nodi, entità,
allegati o tipi applicativi: una lista vuota è corretta, non un errore.
Sono invece presenti amministratore e cataloghi tecnici di sistema.

Se un account con quell'email esisteva già, il seed non ne cambia la password:
usare la credenziale corrente o il flusso di recupero configurato. Non tentare
reset del database per risolvere un problema di login.

Cambiare la password iniziale dall'area account e configurare MFA secondo la
policy del deployment. Conservare i codici di recupero fuori dall'applicazione.
Una successiva modifica di `SEED_ADMIN_PASSWORD` non cambia la password salvata.

## 2. Creare il modello minimo

In **Amministrazione → Modello → Tipi**:

1. Creare un tipo nodo, per esempio “Area di lavoro”. Il nome è descrittivo;
   la chiave tecnica, ad esempio `work_area`, deve essere stabile e valida.
2. Se servono sottolivelli, configurare le regole di posizionamento coerenti
   con i tipi padre/figlio; verificare che il tipo scelto ammetta la radice.
3. Creare un tipo entità, per esempio “Attività”, con chiave `work_item`.
   Se richiesto dal form, indicare una tabella storage valida, per esempio
   `entity_work_item`; non creare manualmente tabelle con SQL. È un identificatore
   del modello: PostgreSQL e SQLite lo realizzano internamente in modo diverso.
4. Aggiungere un campo semplice, per esempio una descrizione testuale. Provare
   salvataggio e riapertura prima di aggiungere enum, relazioni o allegati.
5. Per un enum, configurare le opzioni; per una relazione, predisporre prima
   il tipo destinazione. Per allegati, aggiungere un campo di tipo file/immagine.

Riferimenti: [form dei metadati](RESOURCE_METADATA_FORMS.md),
[enum](MANAGED_ENUMS.md), [relazioni](RESOURCE_RELATIONSHIP_ARCHITECTURE.md),
[ciclo di vita dei tipi](TYPE_LIFECYCLE.md). Gli esempi sono facoltativi e non
vincolano Nodriva a un dominio applicativo.

## 3. Creare il primo contenuto

Dal workspace creare un nodo radice usando il tipo appena definito, assegnargli
un nome e aprirlo. Creare un'entità del tipo “Attività”, compilare i campi e
salvare. Riaprirla e controllare i valori. Una modifica dello schema deve essere
fatta tramite amministrazione, non modificando direttamente il database.

Se un tipo non è selezionabile, verificare che sia attivo e compatibile con le
regole di posizionamento. Non aggirare la validazione del backend.

## 4. Creare un operatore e limitarne il perimetro

In **Amministrazione → Accesso**:

1. Predisporre un ruolo operativo con i soli permessi necessari: lettura,
   creazione e modifica di nodi/entità; aggiungere cancellazione e ripristino
   solo se richiesti. Usare i selettori dei permessi, non SQL.
2. Creare l'utente tramite il flusso disponibile. Gli inviti e il recupero
   password richiedono un canale di consegna configurato: senza tale integrazione
   non aspettarsi email automatiche. Trasmettere eventuali credenziali iniziali
   attraverso un canale sicuro.
3. Assegnare il ruolo e lo scope sul nodo interessato: `self` per il solo nodo,
   `subtree` per il suo sottoalbero, secondo il contratto di autorizzazione.
4. Accedere in un altro profilo browser come operatore e verificare il perimetro.
   Il ruolo da solo non sostituisce lo scope; un superadmin non è adatto a questa
   prova perché dispone di privilegi più ampi.

Su un ambiente di collaudo creare anche un nodo fuori scope e verificare che
non sia accessibile, nemmeno tramite URL diretto. Non usare utenti reali per
prove automatizzate o distribuire credenziali operative negli script.

## 5. Checklist funzionale

- [ ] Login dell'amministratore e dell'operatore riusciti.
- [ ] Modello e contenuti riaperti con valori coerenti.
- [ ] Scope verificato con un'identità non superadmin.
- [ ] Due sessioni sullo stesso record rispettano lock e conflitti di versione;
      nessun form non salvato viene abbandonato senza avviso.
- [ ] Se configurati: caricamento, download e cancellazione di un allegato di
      prova; verifica della scansione quando obbligatoria.
- [ ] Su contenuti di collaudo: cancellazione, cestino e ripristino coerenti;
      audit consultabile in **Amministrazione → Governance**.
- [ ] Se realtime abilitato: seconda sessione aggiornata senza ricaricamento.
      Nel profilo SQLite senza realtime questo controllo è escluso esplicitamente.
- [ ] Dopo un riavvio controllato dati e allegati sono ancora disponibili.
- [ ] Backup di database, payload e chiavi predisposto e restore verificato
      separatamente: [BACKUP_RESTORE.md](BACKUP_RESTORE.md).

Le prove che creano o cancellano contenuti vanno eseguite su dati di collaudo
autorizzati. Per i gate automatici usare le fixture isolate della
[checklist di rilascio](RELEASE_CHECKLIST.md), mai il database operativo.
