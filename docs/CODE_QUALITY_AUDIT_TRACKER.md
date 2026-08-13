# Registro rilievi qualità del codice

Questo file conserva i rilievi dell'audit tecnico successivo al commit
`879aa75`. Gli elementi sono ordinati per priorità e devono essere aggiornati
quando una correzione è verificata.

| Stato | Priorità | Rilievo | Azione prevista |
| --- | --- | --- | --- |
| Risolto | P3 | Quattro warning ESLint per navigazioni interne mediante `window.location.href`. | Il reload completo è intenzionale nei flussi di sessione/logout: ogni riga ha una soppressione ESLint locale e una motivazione del confine di sicurezza. |
| Aperto | P1 | La CI non avvia PostgreSQL e quindi salta le integrazioni e l'unico E2E. | Aggiungere un job con database dedicato, migrazioni e `INTEGRATION_DATABASE_URL`; configurare le credenziali E2E. |
| Risolto | P1 | Script diagnostici/test tracciati ma senza riferimenti: `test_double_save.ts`, `test_login.js`, `test_auth.js`, `test_auth2.js`, `inspect-db.js`, `packages/core/inspect-db.ts`, `packages/web/test_pusher.cjs`, `packages/web/test_ws.cjs`. | Rimossi: alcuni contenevano dati di connessione o sessione non adatti al repository. |
| Aperto | P2 | Il package `@dashboard/core` non ha un lint dedicato; la root esegue solo quello Web. | Introdurre ESLint TypeScript nel core e applicarlo in CI. |
| Aperto | P2 | `EntitySchemaRegistry` espone `z.ZodObject<any>`. | Sostituire `any` con un tipo Zod appropriato. |
| Aperto | P2 | `checkAdminAccessAction` tratta indiscriminatamente dinieghi e guasti infrastrutturali come assenza di accesso. | Intercettare esclusivamente l'errore di autorizzazione atteso e propagare gli altri. |
| Aperto | P2 | Bootstrap PostgreSQL con email demo di fallback e retry DB senza timeout. | Rendere l'email esplicita e aggiungere limiti/timeout al retry. |
| Aperto | P3 | Alcuni `catch` di UI e operativi sono volutamente best-effort, ma non tutti distinguono l'errore atteso da quello inatteso. | Riesaminare per flusso, preservando parsing e fallback di rete intenzionali. |

## Verifiche già positive

- `pnpm audit --prod`: nessuna vulnerabilità nota.
- Confini statici Domain/Application verso Infrastructure: rispettati.
- Contratti condivisi SQLite/PostgreSQL per definizioni di tipo e ACL: presenti.
