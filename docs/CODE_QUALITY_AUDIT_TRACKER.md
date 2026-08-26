# Registro rilievi qualità del codice

Questo file conserva i rilievi dell'audit tecnico successivo al commit
`879aa75`. Gli elementi sono ordinati per priorità e devono essere aggiornati
quando una correzione è verificata.

| Stato | Priorità | Rilievo | Azione prevista |
| --- | --- | --- | --- |
| Risolto | P3 | Quattro warning ESLint per navigazioni interne mediante `window.location.href`. | Il reload completo è intenzionale nei flussi di sessione/logout: ogni riga ha una soppressione ESLint locale e una motivazione del confine di sicurezza. |
| Risolto | P1 | La CI non avviava PostgreSQL e saltava le integrazioni. | Aggiunti job PostgreSQL 17 con bootstrap completo e ruolo applicativo ristretto: integrazioni/contract test Core-Web e `pnpm e2e:parity` su Chromium contro SQLite e PostgreSQL isolati. |
| Risolto | P1 | Script diagnostici/test tracciati ma senza riferimenti: `test_double_save.ts`, `test_login.js`, `test_auth.js`, `test_auth2.js`, `inspect-db.js`, `packages/core/inspect-db.ts`, `packages/web/test_pusher.cjs`, `packages/web/test_ws.cjs`. | Rimossi: alcuni contenevano dati di connessione o sessione non adatti al repository. |
| Risolto | P2 | Il package `@dashboard/core` non aveva un lint dedicato. | Aggiunto ESLint TypeScript al core; `pnpm lint` e quindi `pnpm check` lo eseguono. |
| Risolto | P2 | `EntitySchemaRegistry` esponeva `z.ZodObject<any>`. | Il registry usa ora `z.ZodObject<z.ZodRawShape>`. |
| Risolto | P2 | `checkAdminAccessAction` trattava indiscriminatamente dinieghi e guasti infrastrutturali come assenza di accesso. | Solo `ACCESS_FORBIDDEN` continua la verifica e `AUTH_UNAUTHORIZED` nega l'accesso; i guasti inattesi vengono propagati e la shell li presenta come indisponibilità temporanea con retry. |
| Risolto | P2 | Bootstrap con identità demo, comportamento distruttivo e gestione non uniforme dell'email amministrativa. | PostgreSQL e SQLite usano lo stesso catalogo, accettano `SEED_ADMIN_EMAIL`, sono additivi, transazionali e idempotenti e non sovrascrivono account o configurazioni esistenti. |
| Risolto | P3 | Alcuni `catch` di UI e operativi erano volutamente best-effort, ma non tutti distinguevano l'errore atteso da quello inatteso. | Gli errori client sono coerciti da un unico boundary; accesso nodo, bootstrap e scope delegabili distinguono diniego e indisponibilità; le letture admin fallite non restano in cache e la riconciliazione metadata osserva i fallimenti senza rejection ignorate. Restano intenzionali e documentati soltanto parsing, cleanup e retry passivi. |
| Risolto | P1 | Gli adapter SQLite/PostgreSQL non avevano una verifica complessiva di equivalenza. | Aggiunti contract test condivisi e un E2E che confronta l'intero pannello admin sui due profili isolati. |
| Risolto | P1 | Mancava una verticale utente completa che dimostrasse la parità oltre il pannello admin. | `e2e:canonical` configura schema e accessi, esercita due sessioni, lock, `rowVersion`, relazioni, delete/restore e audit su SQLite e PostgreSQL; `e2e:parity` la esegue insieme alla suite admin. |
| Risolto | P1 | Le route frontend concentravano rendering, stato e orchestrazione in pagine monolitiche. | Estratti screen, sezioni e hook/controller; un test limita `page`/`layout` a 60 righe e vieta gli hook di stato/effetto. |
| Risolto | P2 | `ActivityProvider` concentrava protocollo attività, lifecycle browser e coordinamento lock. | Il provider è ora un boundary di composizione: trasporto, reducer di sessione, gate heartbeat/registro lock e binding browser sono separati. I test coprono throttle, richieste obsolete, lock duplicati, lifecycle dei listener, visibilità e messaggi cross-tab. |
| Risolto | P2 | `VirtualGroupedTable` concentrava finestra, sentinel, scroll e rendering responsivo. | Il componente è ora un boundary di composizione con controller UI, corpo presentazionale e modelli puri per grouping, selezione, sentinel e ancoraggio. Test dedicati preservano debounce, lifecycle observer, compensazione scroll, stati di resa e strutture desktop/mobile; la finestra paginata autorevole resta nella cache semantica. |
| Risolto | P1 | Migrazioni, restore verificato e healthcheck operativo non avevano un unico gate per upgrade, riapplicazione, checksum, freschezza backup e target metriche. | Il bootstrap PostgreSQL verifica schema vuoto, conversione legacy e riapplicazione; il restore usa solo database `*_test_*`, valida il checksum e confronta i dati principali; lo healthcheck isola il progetto Compose e controlla backup verificato e target Prometheus. |
| Risolto | P3 | `NodeTree` manteneva insieme caricamento lazy, stato espanso e rendering ricorsivo. | Il boundary compone controller di espansione e ramo ricorsivo; riga presentazionale e modello puro sono separati. I test preservano toggle, percorso attivo, selezione ARIA, caricamento lazy e aggiornamento del record dalla cache realtime. |

## Verifiche già positive

- `pnpm audit --prod`: nessuna vulnerabilità nota.
- Confini statici Domain/Application verso Infrastructure: rispettati.
- Contratti condivisi SQLite/PostgreSQL per definizioni di tipo, ACL e
  persistenza: presenti; E2E amministrativo di parità presente.
