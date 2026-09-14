# Standard componente → vista → cache → backend

Questo è lo standard per la creazione e la manutenzione dei componenti frontend.

## Percorso di lettura

```text
Componente React
  → hook/coordinator della vista
  → cache semantica (read model locale)
  → Server Action / API
  → Application Service
  → controllo sessione, permessi e scope
  → repository e database
```

Il componente non importa direttamente Server Action, repository o adapter infrastrutturali.
La vista decide quale dato serve; il coordinator verifica la cache e avvia il fetch solo quando il dato è assente, incompleto o stale.

Ogni riga di una vista dichiara riferimenti canonici tipizzati tramite
`namespace`, `id` e livello richiesto (`summary` o `full`). Il resolver valuta
tutti i riferimenti senza conoscere il tipo concreto della vista, deduplica le
hydration concorrenti e considera la vista soddisfatta solo quando ogni
dipendenza obbligatoria è disponibile al livello richiesto. Una vista assente o
strutturalmente stale viene ricaricata interamente; una vista valida con record
mancanti idrata invece soltanto quei record.

## Percorso di mutazione

```text
Componente
  → coordinator della cache
  → Server Action
  → Application Service
  → transazione + autorizzazione + rowVersion
  → evento/realtime
  → aggiornamento o invalidazione della cache
  → sottoscrizioni della vista
```

La cache aggiorna il read model solo dopo una risposta backend valida o un evento realtime accettato. Non autorizza mai l’operazione e non è fonte autorevole.

## Continuità realtime e fallback conservativo

La cache è un read model di sessione, non una fonte autorevole. Realtime è il
percorso normale: propaga subito invalidazioni autorizzate e riduce le letture
HTTP. La correttezza non dipende però dal trasporto WebSocket.

Ogni canale dati autorizzato ha un `epoch` di processo e un cursore monotono.
Ogni consegna contiene cursore, cursore precedente, `eventId` e identificatore
dell'evento precedente. Il browser considera il canale continuo solo se:

- la WebSocket e la sottoscrizione sono attive;
- ogni evento ricevuto segue il precedente cursore del medesimo canale;
- il checkpoint periodico autenticato del server coincide con l'ultimo cursore
  applicato dal browser;
- l'`epoch` del server non è cambiata.

Il server ricava sempre i canali dalla sessione e dalla policy corrente; non
accetta dal browser una scelta di canali come autorizzazione. Il registro dei
cursori è volutamente volatile nella prima implementazione: restart del Web o
cambio istanza cambia `epoch` e richiede il fallback conservativo, senza replay
di eventi.

Disconnessione, errore di sottoscrizione, `epoch` diversa, cursore non
contiguo, checkpoint differente, cambio dei canali autorizzati o fallimento del
checkpoint portano l'intero read model nello stato `unreliable`. In tale stato
la cache avanza una generazione e rende non utilizzabili tutte le proiezioni
precedenti: record, liste, metadata, amministrazione, lock e view store. Le
bozze non salvate restano stato della form, separato dal read model.

Una riconnessione non rende di per sé affidabile la cache. Solo un checkpoint
continuo dopo l'invalidazione consente alle successive letture autorevoli di
popolare la nuova generazione. Il primo checkpoint di una sessione appena
autenticata non invalida le letture già avviate: logout e cambio identità hanno
già svuotato il read model prima del bootstrap. Se HTTP non è raggiungibile, la
UI può mantenere la bozza ma non avvia azioni dipendenti da uno snapshot non
verificato.

Quando realtime è deliberatamente disabilitato, il read model resta nello stato
`disabled`: ogni accesso logico significativo carica dal server la proiezione
necessaria. Durante il primo bootstrap non deve annullare le letture autorevoli
già avviate dalla sessione vuota; le conserva come snapshot da rivalidare. La
cache può deduplicare richieste concorrenti della stessa operazione, ma non
riusa snapshot di una generazione precedente come dati correnti.

Le mutazioni, i lock, l'accesso e il controllo `rowVersion` restano sempre
richieste backend non condizionali e atomiche. La continuità della cache non può
concedere un'azione né eliminare una gara tra due sessioni.

## Sessione e sicurezza

La sessione NextAuth resta la fonte dell’identità corrente e comprende
l'identificatore della specifica sessione server. `AppCache.users` conserva
solo una proiezione UI degli utenti e coordina l’aggiornamento della sessione
quando viene modificato l’utente autenticato.

Ogni Server Action deve continuare a risolvere l’attore dal backend e verificare
autorizzazioni, scope e concorrenza. Le mutazioni protette da lock verificano
sia l'utente sia la sessione proprietaria. Logout, cambio identità e risposta
non autorizzata eseguono `AppCache.purgeAll()`.

Il layer `ActivityProvider` è l'unico coordinatore client dell'attività umana:
rinnova sessione e lock registrati tramite `/api/activity`. Il polling
`/api/sync/access` è soltanto riconciliazione passiva e non può rinnovare la
sessione. Tempi e comportamento sono documentati in
[`HUMAN_ACTIVITY_SESSION_LOCKS.md`](./HUMAN_ACTIVITY_SESSION_LOCKS.md).
Il provider è un boundary di composizione: il protocollo HTTP, la macchina di
stato della sessione, il gate temporale/registro lock e i binding DOM e
`BroadcastChannel` restano separati e testabili senza duplicare il
coordinamento.

Le liste di sottoalbero mantengono la finestra paginata nella vista della cache
semantica. `VirtualGroupedTable` compone soltanto controller UI, sentinel,
ancoraggio e resa desktop/mobile: non conserva una seconda copia locale della
finestra e non decide quali pagine trattenere o espellere.

Il breadcrumb dei nodi è una vista semantica autoritativa, non una proiezione
opportunistica dei soli record già in RAM. Al cold reload risolve dal backend la
catena contigua di nodi leggibili fino al confine di scope, idrata i record
canonici e distingue loading, errore e retry. Non deve interrogare gli antenati
uno alla volta dal componente né mostrare identificatori tecnici come fallback.

## Regole operative

- usare `AppCache` o un coordinator di dominio per ogni dato condiviso;
- usare le facade tipizzate del `CacheKernel` per dati normalizzati e sottoscrivibili;
- usare `GlobalViewStore` solo per descrittori, paginazione e stato della vista;
- invalidare le viste quando l’ordinamento o la composizione della lista può cambiare;
- dichiarare dipendenze strutturali tramite token e dipendenze dai dati tramite riferimenti tipizzati;
- non duplicare lo stesso oggetto in `useState` come cache parallela;
- centralizzare mapping errori, retry, session refresh e purge;
- aggiungere test di cache hit/miss, deduplicazione, `notModified`, revisione
  modificata, indisponibilità di rete, reconnect realtime, rowVersion, evento
  realtime e cambio sessione.

## Interazione amministrativa e valori semantici

Le UI amministrative traducono contratti tecnici in compiti comprensibili. Per
le regole vincolanti su cataloghi, chiavi, filtri, progressive disclosure e
test, consultare
[`ADMINISTRATIVE_UX_SEMANTIC_CATALOGS.md`](./ADMINISTRATIVE_UX_SEMANTIC_CATALOGS.md).
In particolare, un identificatore tecnico non può essere l'unica opzione
offerta all'utente quando il backend può esporre un catalogo autorizzato di
etichette e descrizioni.

## Contratto trasversale di reattività dei componenti

Queste regole valgono per **ogni componente presente e futuro**, non soltanto
per le viste o per i componenti che usano `GlobalViewStore`.

Un flusso dati asincrono è completo soltanto quando sono verificati tutti i
passaggi seguenti:

```text
dato recuperato → dato scritto nella fonte canonica → sottoscrittori notificati
→ componente rivalutato → valore visualizzato aggiornato
```

- Un dato presente nella cache ma non propagato al componente è considerato un
  bug di reattività, non un caricamento ancora in corso.
- Ogni componente che visualizza dati condivisi deve consumarli tramite una
  fonte osservabile o un hook che ne esponga la revisione; non può leggere una
  cache mutabile soltanto durante il render iniziale.
- Ogni `React.memo` deve confrontare tutte le props che possono modificare il
  risultato visivo, incluse callback, renderer di colonne, formatter e
  configurazioni funzionali. Se il confronto non può essere dimostrato
  corretto, il comparatore personalizzato non va introdotto.
- Le configurazioni funzionali usate come props devono essere stabilizzate con
  `useMemo`/`useCallback` quando serve preservare il beneficio della
  memoizzazione senza impedire gli aggiornamenti reali.
- Ogni componente che riceve dati dopo il mount deve avere un test di
  regressione che verifichi: primo render senza dato, inserimento o modifica
  del dato, notifica e aggiornamento del DOM. Per liste o tabelle il test deve
  anche dimostrare che l'aggiornamento non ricostruisce inutilmente gli altri
  elementi.
- Skeleton, fallback tecnici e stato vuoto non possono mascherare una mancata
  notifica. Un identificatore tecnico non è un sostituto del dato semantico.

Prima di modificare cache, fetch o resolver per un'anomalia UI, verificare in
ordine: persistenza/risposta, scrittura canonica, notifica, memoizzazione e
rendering. La modifica deve fermarsi al primo livello che fallisce.

## Continuità delle interazioni

Ogni superficie interattiva — screen, pagina, collection, albero, dettaglio,
form, drawer, modale e controllo riusabile — osserva lo stesso contratto di
continuità. Il contratto riguarda la transizione percepita dalla persona,
non il particolare componente che la rende.

### Identità stabile

Un controller, una view cache, una form surface o una sottoscrizione può
dipendere soltanto dal proprio contesto semantico stabile: identità/sessione,
route, scope autorizzato, risorsa selezionata e dichiarazione immutabile della
funzione. Non può dipendere da un risultato temporaneo di un'interazione, da
un errore, da un flag pending, dal contenuto di una bozza o da dati ricevuti
dopo il mount.

Questi ultimi sono snapshot del lifecycle del controller esistente. Cambiarli
non può costruire un nuovo controller, azzerare la cache della vista,
riavviare il caricamento iniziale, rimontare una superficie o perdere stato
utente. Un cambio reale di contesto semantico crea invece una nuova identità e
deve dichiarare esplicitamente il destino di selezione, filtri, pagina, scroll,
lock e bozze.

### Classi di operazione

Ogni callback asincrona dichiara una sola semantica primaria e usa il
lifecycle condiviso del proprio owner:

| Classe | Effetto sulla proiezione | Stato utente da preservare |
|---|---|---|
| caricamento iniziale | acquisisce la prima proiezione autorevole | geometria di caricamento e focus quando applicabili |
| refresh o invalidazione realtime | rilegge la proiezione sul controller corrente | righe precedenti, filtri, ordinamento, pagina, scroll, selezione e bozze compatibili |
| probe o verifica | aggiorna l'esito dell'operazione o della risorsa interessata | intera vista e tutte le superfici non coinvolte |
| mutazione | applica il risultato autorevole oppure invalida e rilegge la proiezione corrente | vista, contesto di lavoro e bozze non rese invalide dalla mutazione |
| navigazione, logout o cambio identità | sostituisce intenzionalmente il contesto | solo lo stato dichiarato dal contratto di transizione |

Un refresh in background non trasforma una vista già utilizzabile in skeleton.
Un probe non è un refresh nascosto. Una mutazione non può dichiararsi riuscita
finché il suo risultato autorevole, invalidazione o errore non è stato
riconciliato nel proprio owner. Logout, risposta non autorizzata e cambio
identità restano transizioni di sicurezza e possono effettuare il purge
globale previsto dalla sezione Sessione e sicurezza.

### Owner e composizione

Lo stato condiviso appartiene a cache, coordinator o controller; lo stato di
una superficie appartiene alla sua form surface, navigation controller o
interaction controller. `useState` locale è ammesso soltanto per dettagli di
presentazione effimeri, quali apertura di un menu, focus, query non ancora
applicata o espansione locale. Non deve possedere una seconda copia di dati
autorevoli, né decidere in autonomia refresh, retry, invalidazione, lock,
sessione, draft persistenti o transizioni di navigazione.

Una screen compone owner già definiti e fornisce configurazione immutabile. Se
due screen condividono una categoria di operazione, il protocollo di pending,
errore, conciliazione e conservazione dello stato vive in un oggetto generico
riusabile, non in callback locali equivalenti. L'owner non deve diventare una
classe universale: cache di dominio, controller di form e controller di
collection possono differire internamente, ma espongono le stesse transizioni
osservabili per la stessa classe di operazione.

### Verifica obbligatoria

Ogni owner di lifecycle copre con test le proprie transizioni: primo
caricamento, refresh con dati precedenti visibili, risposta obsoleta, errore e
retry. Un owner che esegue probe o mutazioni copre inoltre controller stabile,
assenza di reload non richiesto, conservazione di selezione/filtro/bozza e
riconciliazione dell'esito. Le transizioni di navigazione, sessione e lock
coprono il loro cleanup esplicito.

Prima di introdurre un nuovo hook o stato locale, il modulo deve indicare
l'owner già esistente oppure motivare un nuovo owner in base a una transizione
osservabile non coperta. Una pagina non è un owner di lifecycle.

## Contratto progettuale obbligatorio per componenti e hook

Prima di introdurre o modificare in modo sostanziale un componente, uno screen
o un hook che rappresenta dati, la relativa responsabilità deve dichiarare per
iscritto i punti seguenti. La dichiarazione può appartenere al documento del
modulo quando serve a più componenti; non va ripetuta come commento meccanico
in ogni file.

1. **Responsabilità e boundary:** quale informazione o interazione possiede e
   quale layer/controller ne orchestra gli effetti.
2. **Fonte autorevole:** Server Action/API, read model e cache/coordinator
   attraverso cui il dato viene letto; un componente non crea una cache locale
   parallela per dati condivisi.
3. **Accesso ed errori:** permesso richiesto e distinzione osservabile fra dato
   vuoto, diniego applicativo, guasto infrastrutturale e retry.
4. **Strategia di aggiornamento:** scegliere esplicitamente una sola semantica
   primaria fra dato statico, refresh manuale, fonte osservabile o invalidazione
   realtime. Una collection visibile che può diventare obsoleta durante la
   permanenza nella pagina dichiara le proprie dipendenze semantiche e usa il
   lifecycle condiviso di refresh; per esempio `['audit']` o `['types']`.
5. **Mutazioni e concorrenza:** indicare se una mutazione aggiorna una
   proiezione locale, invalida la vista o richiede un reload autorevole, e
   mantenere backend, lock e `rowVersion` come fonte di verità.
6. **Capability opzionali:** per ogni integrazione configurabile indicare il
   comportamento con capability attiva, disattivata e non disponibile. Una
   capability deliberatamente disattivata è uno stato operativo previsto, non
   un errore: la funzionalità comune resta utilizzabile con il suo fallback
   esplicito, senza chiamate all'integrazione assente né messaggi di guasto.
7. **Lifecycle visivo:** definire loading, dati precedenti durante un refresh,
   stato vuoto, errore, retry e ritorno dal background quando applicabili.
8. **Verifica:** aggiungere test proporzionati al contratto, inclusi per dati
   condivisi primo caricamento, aggiornamento della fonte, notifica e DOM
   aggiornato; per capability opzionali coprire anche il percorso disattivato.

La regola non impone realtime a ogni componente. Il realtime è soltanto una
strategia di aggiornamento: quando è configurato, il componente dichiara la
collection da invalidare e rilegge dal backend; quando non è configurato,
mantiene il comportamento funzionale comune tramite caricamento iniziale e
refresh esplicito o altra strategia dichiarata.

## Composizione delle route

I file App Router `page.tsx` e `layout.tsx` sono entry point sottili. Possono
risolvere i parametri della route e comporre uno screen, ma stato, effetti,
reducer e transizioni devono vivere in hook/controller dedicati. Gli screen
compongono sezioni e modali; i componenti presentazionali ricevono dati e
callback tipizzati.

`ArchitectureCompliance.test.ts` applica a tutte le route un limite di 60
righe e vieta `useState`, `useEffect`, `useReducer` e `useTransition`. Il limite
non si applica automaticamente ai componenti infrastrutturali complessi: per
questi la separazione avviene per responsabilità osservabile e deve mantenere
test di protocollo, accessibilità e comportamento.

## Error handling dei flussi UI

- Gli errori applicativi attesi attraversano il boundary delle Server Actions
  come `ApiErrorResponse` tipizzate. Il client può mostrarli senza reinterpretare
  codici o messaggi.
- Un errore inatteso non deve essere convertito in lista vuota, accesso negato o
  database non inizializzato. I check autorizzativi propagano i guasti e la UI
  presenta uno stato `unavailable` con retry distinto dal diniego.
- Le operazioni best-effort passive, come polling di riconciliazione, heartbeat
  e drain post-commit, non interrompono il lavoro dell'utente ma devono
  registrare l'esito o produrre un log; non sono ammesse promise rejection
  ignorate.
- I fallback silenziosi restano ammessi soltanto per parsing non autorevole,
  cleanup idempotente o rappresentazione di debug. Non possono determinare
  autorizzazioni, presenza di dati o successo di una mutation.

## Stati di caricamento

Quando una vista non dispone ancora dei dati necessari, deve preservare per
quanto possibile la geometria del contenuto. È condivisa soltanto la primitiva
visiva `Skeleton` e il wrapper accessibile `SkeletonState`: ogni componente
compone localmente forme, quantità e dimensioni coerenti con il contenuto che
sostituiranno. Colore e animazione appartengono invece esclusivamente alla
primitiva e non possono essere sovrascritti dai singoli componenti. Il
caricamento non deve introdurre testi transitori, spinner o
un placeholder generico a righe. Lo stato resta annunciato alle tecnologie
assistive tramite `role="status"` e un'etichetta descrittiva non visibile; le
animazioni rispettano la preferenza di movimento ridotto.

Un refresh in background non sostituisce dati completi e ancora utilizzabili
con uno skeleton. Errori, risultati vuoti e retry restano stati espliciti e
distinti. Le mutation conservano invece un feedback testuale come
`Salvataggio…`: indicano un'operazione in corso, non dati mancanti.

## Migrazione

Nodi ed entità seguono già questo modello tramite `AppCache`. I form dinamici
condividono `dynamicResourceForm` per inizializzazione, coercizione e allegati.
Il pannello amministrativo usa `AdminCacheClient` per tipi, sistema, sicurezza,
placement policy e audit. Il vertical slice utenti/sessione usa
`UserCacheClient` e `SessionCacheSynchronizer`.

Login e logout restano coordinatori di autenticazione, non dati applicativi:
aggiornano la sessione NextAuth e invocano il purge della cache. Il logout
volontario rilascia inoltre i lock appartenenti alla specifica sessione. Sono
gli unici componenti autorizzati a chiamare direttamente le action di
autenticazione.
