# Registro della portabilità architetturale

Questo documento definisce il confine di portabilità del database di Nodriva.
È un guardrail operativo per le modifiche future e va aggiornato quando viene
introdotta una nuova capability di storage o messaggistica.

## Regola obiettivo

Il codice Domain e Application non deve dipendere da PostgreSQL, `pg`, sintassi
SQL, `PgExecutor` o API di persistenza specifiche di un framework.

Gli adapter Infrastructure possono dipendere da PostgreSQL, `pg`, `ltree`, SQL
e DDL. La composition root (`packages/web/src/server/db.ts`) assembla gli
adapter concreti e li inietta nei servizi applicativi.

## Confine corrente

| Responsabilità | Contratto applicativo | Adapter PostgreSQL | Adapter SQLite |
|---|---|---|---|
| Utenti e autenticazione | `UserRepository` | `UserRepositoryPostgres` | `UserRepositorySqlite` |
| Sessioni | `SessionRepositoryPort` | `SessionRepositoryPostgres` | `SessionRepositorySqlite` |
| Gerarchia nodi | `NodeRepository` | `NodeRepositoryPostgres` | `NodeRepositorySqlite` |
| Scope realtime nodi | `RealtimeScopeResolver` | `RealtimeScopeResolverPostgres` | `RealtimeScopeResolverSqlite` |
| Consegna eventi dati | `RealtimeEventBus` | `PusherEventBus` | — |
| Consegna realtime durevole | `RealtimeOutboxPort` | `RealtimeOutboxPostgres` | `RealtimeOutboxSqlite` |
| Catalogo workflow e idempotenza | `WorkflowRepository` | `WorkflowRepositoryPostgres` | `WorkflowRepositorySqlite` |
| Pubblicazione mutazione-workflow | `WorkflowEventPublisher` | `WorkflowEventProcessor` | `WorkflowEventProcessor` |
| Transazioni | `TransactionPort` | `TransactionPortPostgres` | `TransactionPortSqlite` |
| Storage tipi dinamici | `StorageTableManagementPort` | tabelle fisiche tramite DDL controllato | payload JSON e metadati relazionali |
| Allegati e quota | `AttachmentRepository` | `AttachmentRepositoryPostgres` | `AttachmentRepositorySqlite` |
| Limite upload | `AttachmentRateLimitPort` | `AttachmentRateLimitPortPostgres` | `AttachmentRateLimitPortSqlite` |
| Limite tentativi login | `LoginRateLimitPort` | `LoginRateLimitPortPostgres` | `LoginRateLimitPortSqlite` |

L'implementazione PostgreSQL materializza inoltre il path gerarchico assegnato
in `node_scope_assignments.node_path`. È una proiezione dell'adapter mantenuta
da trigger del database e non appartiene al contratto applicativo.

`listAncestorIds()` è un'operazione semantica del repository. PostgreSQL la
implementa con `ltree`, ma ogni altro adapter deve implementare lo stesso
contratto con il proprio meccanismo gerarchico.

La composition root Web seleziona il profilo tramite
`DATABASE_ADAPTER=postgres|sqlite`. SQLite non viene esposto al browser: il
frontend dipende solo da Server Action e contratti applicativi.

## Verifica della parità

`PersistenceAdapterParityPostgres.test.ts` esegue lo stesso scenario osservabile
su SQLite in memoria e sul database PostgreSQL di integrazione dedicato.
Confronta gerarchia, entità, errori di versione obsoleta, soft delete/restore,
lock, rollback, quote allegati e rate limit, senza richiedere SQL o schemi
fisici identici.

`WorkflowRepository` ha una suite di contratto condivisa tra gli adapter.
Verifica sostituzione del catalogo eventi, filtro deterministico delle
definizioni attive, idempotenza evento/piano, transizioni delle lease durevoli e
statistiche operative del backlog senza assumere che il soggetto sia nodo o
entità.

`pnpm e2e:admin-parity` estende il contratto tramite build Web production:
clona `dashboard_test` in un database PostgreSQL temporaneo, crea un database
SQLite temporaneo, avvia entrambi i profili e confronta overview Admin, sezioni,
flussi di creazione/dettaglio e azioni audit. Dati e processi temporanei vengono
rimossi all'uscita dello script.

`pnpm e2e:canonical` esercita la verticale project operations su entrambi i
profili: configurazione tipi/campi dinamici, enum e relazioni, accesso operatore
in scope, diniego fuori scope, due sessioni dello stesso utente, conflitto lock,
`rowVersion` obsoleto, delete/restore e audit. Confronta esiti semantici, non il
layout dello storage. `pnpm e2e:parity` esegue gli scenari Admin e canonico in
sequenza per evitare lock amministrativi condivisi o finestre audit miste. Il
job CI `Browser parity on SQLite and PostgreSQL` usa un database PostgreSQL
usa-e-getta e un ruolo applicativo ristretto.

## Dipendenze vietate

I seguenti import sono vietati in `domain/` e `application/`:

```text
pg
PgExecutor
infrastructure/postgres
stringhe SQL
Next.js, React, SDK Pusher
```

Se un caso d'uso necessita di persistenza, aggiungere o riusare un port. Non
importare un adapter per evitare di definire il contratto.

## Regola per gli scope realtime

Gli eventi dati sono pubblicati su canali condivisi determinati dalla policy
ACL. La risoluzione dello scope è responsabilità Infrastructure esposta tramite
`RealtimeScopeResolver`; il Web invoca solo il contratto iniettato. L'evento è
persistito nell'outbox dentro la transazione business e consegnato dopo il
commit. I canali lock restano separati perché hanno lifecycle e semantica di
errore diversi.

Il resolver deve fornire uno scope sicuro di fallback quando fallisce la ricerca
di un antenato. La consegna realtime è best-effort dopo un commit riuscito: gli
errori vengono registrati e non devono effettuare rollback di una mutazione già
committata.

## Aggiungere un altro adapter database

1. Implementare ogni port applicativo richiesto.
2. Conservare semantica Domain, concorrenza ottimistica e autorizzazione.
3. Implementare query gerarchiche come `listAncestorIds()` senza esporre la
   tecnologia del database nel port.
4. Fornire un adapter transazionale con lo stesso contratto commit/rollback.
5. Aggiungere test adapter e test d'integrazione sul nuovo database.
6. Aggiungere uno scenario browser parity per i flussi utente coinvolti.
7. Collegare l'adapter solo nella composition root.
8. Eseguire i controlli statici per garantire che Application e Domain non
   importino Infrastructure.

## Checklist di revisione

- Il file Application modificato importa `infrastructure/` o `pg`?
- Un nuovo comportamento storage è rappresentato da un port?
- SQL, DDL ed escaping degli identificativi sono confinati in Infrastructure?
- Gli errori realtime sono registrati con un fallback utile?
- Le mutazioni committate restano corrette quando il broker è offline?
- L'adapter ha test per righe mancanti, versioni obsolete ed errori?
- Produce lo stesso risultato visibile nell'E2E Admin parity?
- Se usa nomi dinamici di tabelle o colonne, gli identificativi sono in allowlist
  e quotati dall'adapter invece di essere interpolati da una request?
- Se sostituisce `ltree` o `SKIP LOCKED`, i test di contenimento ACL e claim
  concorrente dell'outbox dimostrano lo stesso comportamento osservabile?
