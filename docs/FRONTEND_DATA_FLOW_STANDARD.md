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

## Regole operative

- usare `AppCache` o un coordinator di dominio per ogni dato condiviso;
- usare `DomainCacheClient` per entità normalizzate e sottoscrivibili;
- usare `GlobalViewStore` solo per descrittori, paginazione e stato della vista;
- invalidare le viste quando l’ordinamento o la composizione della lista può cambiare;
- non duplicare lo stesso oggetto in `useState` come cache parallela;
- centralizzare mapping errori, retry, session refresh e purge;
- aggiungere test di cache hit/miss, deduplicazione, rowVersion, evento realtime e cambio sessione.

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
