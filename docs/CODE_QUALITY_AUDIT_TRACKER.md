# Registro rilievi qualità del codice

Questo file conserva i rilievi dell'audit tecnico successivo al commit
`879aa75`. Gli elementi sono ordinati per priorità e devono essere aggiornati
quando una correzione è verificata.

| Stato | Priorità | Rilievo | Azione prevista |
| --- | --- | --- | --- |
| Risolto | P3 | Quattro warning ESLint per navigazioni interne mediante `window.location.href`. | Il reload completo è intenzionale nei flussi di sessione/logout: ogni riga ha una soppressione ESLint locale e una motivazione del confine di sicurezza. |
| Risolto | P1 | La CI non avviava PostgreSQL e saltava le integrazioni. | Aggiunto un job PostgreSQL 17 con database `dashboard_ci_test`, bootstrap completo, ruolo applicativo ristretto, integrazioni Core/Web e contract test di parità. Gli E2E browser restano un release gate separato. |
| Risolto | P1 | Script diagnostici/test tracciati ma senza riferimenti: `test_double_save.ts`, `test_login.js`, `test_auth.js`, `test_auth2.js`, `inspect-db.js`, `packages/core/inspect-db.ts`, `packages/web/test_pusher.cjs`, `packages/web/test_ws.cjs`. | Rimossi: alcuni contenevano dati di connessione o sessione non adatti al repository. |
| Risolto | P2 | Il package `@dashboard/core` non aveva un lint dedicato. | Aggiunto ESLint TypeScript al core; `pnpm lint` e quindi `pnpm check` lo eseguono. |
| Risolto | P2 | `EntitySchemaRegistry` esponeva `z.ZodObject<any>`. | Il registry usa ora `z.ZodObject<z.ZodRawShape>`. |
| Aperto | P2 | `checkAdminAccessAction` tratta indiscriminatamente dinieghi e guasti infrastrutturali come assenza di accesso. | Intercettare esclusivamente l'errore di autorizzazione atteso e propagare gli altri. |
| Parziale | P2 | Bootstrap con identità demo e gestione non uniforme dell'email amministrativa. | SQLite accetta `SEED_ADMIN_EMAIL` e rifiuta overwrite; allineare anche il seed PostgreSQL e rendere esplicita la policy per ambienti non demo. |
| Aperto | P3 | Alcuni `catch` di UI e operativi sono volutamente best-effort, ma non tutti distinguono l'errore atteso da quello inatteso. | Riesaminare per flusso, preservando parsing e fallback di rete intenzionali. |
| Risolto | P1 | Gli adapter SQLite/PostgreSQL non avevano una verifica complessiva di equivalenza. | Aggiunti contract test condivisi e un E2E che confronta l'intero pannello admin sui due profili isolati. |
| Risolto | P1 | Le route frontend concentravano rendering, stato e orchestrazione in pagine monolitiche. | Estratti screen, sezioni e hook/controller; un test limita `page`/`layout` a 60 righe e vieta gli hook di stato/effetto. |
| Aperto | P2 | `ActivityProvider` concentra protocollo attività, lifecycle browser e coordinamento lock. | Separare trasporto, macchina di stato e binding DOM mantenendo invarianti e test temporali. |
| Aperto | P2 | `VirtualGroupedTable` concentra virtualizzazione, sentinel, scroll e rendering responsivo. | Estrarre controller della finestra/sentinel e componenti di resa con test di scroll e resize. |
| Aperto | P3 | `NodeTree` mantiene insieme caricamento lazy, stato espanso e rendering ricorsivo. | Rifattorizzare solo insieme a test di espansione, selezione e aggiornamento realtime; priorità inferiore agli altri due moduli. |

## Verifiche già positive

- `pnpm audit --prod`: nessuna vulnerabilità nota.
- Confini statici Domain/Application verso Infrastructure: rispettati.
- Contratti condivisi SQLite/PostgreSQL per definizioni di tipo, ACL e
  persistenza: presenti; E2E amministrativo di parità presente.
