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
- aggiungere test di cache hit/miss, deduplicazione, rowVersion, evento realtime e cambio sessione.

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
