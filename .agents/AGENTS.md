# Agent Behavioral Rules & Directives

## Form & CRUD Verification Rule
- Ogni volta che viene implementato o modificato un form o una pagina che effettua operazioni CRUD (create, read, update, delete), è obbligatorio:
  1. Eseguire la build del pacchetto Web (`npx pnpm --filter @dashboard/web run build`) e del Core (`npx pnpm --filter @dashboard/core run build`).
  2. Eseguire la suite di test (`npx --yes vitest run`) per verificare che l'integrazione ed i flussi CRUD funzionino senza regressioni.

## Architectural Compliance Rule (Semantic Cache Engine)
- `packages/web/src/app/cache/ARCHITECTURE.md` è il documento normativo vincolante per ogni intervento su data fetching, caching, mutazioni e reattività.
- `.gemini/config/skills/semantic-cache-engine/SKILL.md` è la guida operativa derivata.
- Prima di proporre modifiche, codice o refactor:
  1. Verificare coerenza con ARCHITECTURE.md.
  2. Se l'implementazione diverge dal documento, segnalare la divergenza prima di procedere.
  3. Non introdurre pattern che violano l'architettura canonica.
  4. Non reinterpretare liberamente i layer.
- Regole vincolanti:
  - EntityStore canonico = unica source of truth dei payload.
  - ViewStore = solo descrittori/riferimenti/metadati di navigazione.
  - SemanticViewKey derivata solo da parametri semantici stabili; mai da endpoint, cursori, direzione, offset o timestamp.
  - Una key identifica l'intera vista; le pagine stanno sotto la vista.
  - Solo il service layer / FetchCoordinator può conoscere endpoint o server actions.
  - UI, hook adapter e selector non possono fare fetch diretto.
  - Le mutazioni passano da AppCache.
  - L'eviction di una view non implica rimozione delle entità canoniche.
  - `useReadModel`, context legacy o read-model globali non devono essere reintrodotti.
- Se ARCHITECTURE.md e implementazione divergono: trattare ARCHITECTURE.md come riferimento normativo e proporre l'allineamento del codice, oppure segnalare il punto da decidere esplicitamente.

## Next.js 14+ Forms & Server Actions Rule
- Per i form che chiamano Server Actions, preferisci il pattern nativo `<form action={serverAction}>`. Questo è il pattern standard del progetto.
- L'uso di `action={serverAction}` abilita il *progressive enhancement* fornito da React/Next.js ed evita fallback a richieste GET anomale sui dispositivi mobile (in particolare Safari iOS con autofill/tastiere virtuali).
- Usa `onSubmit` manuale con `e.preventDefault()` solo quando c’è una motivazione reale, complessa e specifica (es. intercettazioni custom, validazioni che richiedono stop della propagazione prima del framework).
- *Nota storica:* Il precedente vincolo "non usare action sul form" è stato esplicitamente dichiarato obsoleto e rimosso, in quanto anti-pattern in Next.js App Router e causa di bug su device mobili. Tutti i nuovi form CRUD devono seguire il pattern di default `action={...}`.
