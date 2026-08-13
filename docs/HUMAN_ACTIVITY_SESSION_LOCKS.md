# Attività umana, sessioni e lock

Questo documento descrive il contratto condiviso tra client e server per
inattività, rinnovo della sessione autenticata e lock di modifica.

## Unica configurazione temporale

Nella fase di test la fonte dei tempi è
`packages/web/src/config/runtimeTiming.ts`. Il solo valore configurabile è
temporaneamente `NEXT_PUBLIC_SESSION_IDLE_TIMEOUT_SECONDS`; tutti gli altri
intervalli sono derivati, quindi non devono essere introdotti timer applicativi
hardcoded per sessione, heartbeat, lock o polling.

Prima della produzione, la durata deve diventare una configurazione backend
autorevole e modificabile a runtime, distribuita al client senza rebuild. Il
lavoro ancora aperto è tracciato nella sezione **Runtime session policy** di
[`BACKEND_ALIGNMENT_TODO.md`](./BACKEND_ALIGNMENT_TODO.md).

Con il valore predefinito attuale di 1800 secondi:

| Concetto | Derivazione | Valore attuale |
| --- | --- | ---: |
| Inattività massima sessione | configurazione | 1800 s (30 min) |
| Throttle heartbeat | sessione / 6 | 300 s (5 min) |
| Polling di riconciliazione | sessione / 6 | 300 s (5 min) |
| TTL lock | 2 × heartbeat | 600 s (10 min) |

I seed PostgreSQL e SQLite usano lo stesso default. La migrazione
`033_session_idle_timeout_30_minutes.sql` riallinea anche le installazioni
PostgreSQL esistenti.

Il TTL del lock è quindi più corto della sessione. Nel normale flusso di
inattività, quando la sessione scade non può esserci un suo lock ancora attivo:
l'ultimo lock è già scaduto. Può rimanere temporaneamente una riga scaduta nel
database, ma non viene considerata un lock valido e può essere sovrascritta.

## Attività umana e heartbeat

Il client considera attività umana gli eventi `pointerdown`, `keydown`, `input`
e `wheel`, anche quando originano da scrollbar o pannelli sovrapposti. Se la
pagina è visibile, il primo evento oltre la finestra di throttle invia
`POST /api/activity`.

Il server usa l'identità risolta dalla sessione, mai dati identitari forniti dal
client, e nella stessa transazione:

1. estende la scadenza della specifica sessione autenticata;
2. estende fino al TTL derivato soltanto i lock registrati come attivi nel
   client e posseduti dalla medesima sessione;
3. restituisce la nuova scadenza della sessione e l'elenco dei lock realmente
   rinnovati.

Un errore di rete o server non prova che la sessione sia scaduta. Solo una
risposta `401` o una verifica autorevole negativa porta il client allo stato
`Sessione scaduta`, svuota la cache e interrompe polling, realtime e listener di
attività.

La stessa distinzione vale nel callback JWT di Auth.js: soltanto
`AUTH_UNAUTHORIZED` rimuove dal token firmato l'identità della sessione
persistita. Un errore infrastrutturale conserva le claim già firmate e lascia
che la richiesta successiva ritenti la verifica. Questo non prolunga la
sessione nel database: dopo il ripristino, una sessione che nel frattempo è
realmente scaduta viene comunque rifiutata e invalidata.

## Background e verifica della scadenza

I browser, soprattutto su mobile, possono sospendere timer e rete quando la
pagina è in background. Il sistema non dipende quindi dalla puntualità di un
timer client per far scadere la sessione: la scadenza autorevole è nel database.

Quando la pagina torna visibile, `GET /api/activity` verifica lo stato senza
rinnovarlo. Anche il watcher locale esegue la stessa verifica poco dopo la
scadenza conosciuta; in caso di rete irraggiungibile ritenta senza dichiarare
falsamente la sessione scaduta.

## Polling e realtime

`GET /api/sync/access` è una riconciliazione passiva di canali realtime, scope e
radici virtuali. Non rappresenta attività umana e non rinnova né sessione né
lock. Il realtime rimane il canale primario; il polling recupera cambi di
permessi o sottoscrizioni persi e viene eseguito anche al ritorno in foreground.

## Proprietà del lock

Ogni lock contiene sia `user_id` sia `session_id`. La proprietà è della
specifica sessione autenticata:

- due schede che condividono la stessa sessione browser condividono la
  proprietà;
- un altro dispositivo o un altro login dello stesso utente ha una sessione
  diversa e vede il lock come appartenente ad altri;
- tutte le mutazioni protette verificano sul server sia utente sia sessione;
- eventi realtime e cache client conservano `sessionId`, così un rilascio
  ritardato di una vecchia sessione non cancella un lock acquisito nel frattempo
  da un'altra.

L'uscita dalla modalità modifica tenta il rilascio esplicito. Il logout
volontario rilascia e pubblica gli eventi per tutti i lock della sessione prima
di eliminare la sessione. La foreign key
`locks.session_id -> user_sessions.id ON DELETE CASCADE` è la garanzia finale
per revoche, errori o percorsi amministrativi. Alla scadenza per inattività, il
TTL più breve del lock resta invece il meccanismo normale di sicurezza.

## Modifiche non salvate

I form di creazione e modifica del workspace e del pannello amministrativo
registrano una guardia soltanto quando il loro valore differisce dal dato
persistito (o contiene nuovi allegati). La guardia copre i link Next.js, le
navigazioni imperative note, il logout, il refresh e la chiusura della scheda;
nei browser che espongono la Navigation API copre anche avanti/indietro.

L'annullamento locale chiede conferma prima di azzerare il form o rilasciare il
lock. Un errore di validazione, rete o persistenza mantiene invece sia la bozza
sia il lock. Dopo un salvataggio riuscito la nuova versione diventa il baseline
e la navigazione applicativa può proseguire senza un falso avviso.

Il rilascio di emergenza del lock usa `pagehide`, non `beforeunload`: in questo
modo un utente che annulla l'uscita dalla pagina conserva il lock della propria
sessione. La pulizia React continua a rilasciarlo sulle navigazioni client-side
effettivamente completate.

## Diagnostica

Con `NEXT_PUBLIC_ACTIVITY_DEBUG=true` il pannello Activity/Sync mostra attività
rilevata, heartbeat, scadenza nota, polling, lock registrati e relativi errori.
Il pannello è osservabilità: interagirvi conta come normale attività umana, ma
non modifica direttamente sessione o lock.
