# Governance della documentazione

[Italiano](DOCUMENTATION_GOVERNANCE.it.md) | [English](DOCUMENTATION_GOVERNANCE.md)

## Ordine delle autorità

1. Codice sorgente, migrazioni eseguibili e test automatici definiscono il
   comportamento runtime osservato.
2. `ARCHITECTURE.md` e i documenti normativi in `docs/` definiscono
   architettura e modello operativo attesi.
3. Requisiti storici, alternative progettuali e direzione prodotto sono archivi
   locali privati, non contratti eseguibili di API, schema o deployment.
   Sono esclusi da Git e non sono necessari per installare il progetto.
   `Specifiche/dashboard_v4_schema_corrected.sql` è l'eccezione esplicita:
   nonostante la directory, è lo schema eseguibile d'installazione e resta
   versionato fino a una ricollocazione coordinata.

Note di pianificazione, prompt AI, handoff, audit datati e tracker conclusi
sono materiale di lavoro privato e non fanno parte della documentazione
pubblica. `.gitignore` esclude i file storici in `Specifiche/` tranne lo SQL
eseguibile, la directory `docs/adr/` e i report datati
`docs/AUDIT_REMEDIATION_*.md`. Smettere di tracciare questi file conserva le
copie locali e non cancella la loro presenza nei commit precedenti; riscrivere
la storia del repository richiede un'operazione separata ed esplicita.

Quando codice e documentazione normativa divergono, è un difetto: aggiornare
l'implementazione o il documento nella stessa modifica. Quando un requisito
storico viene superato intenzionalmente, conservarlo e registrare la decisione
nel documento operativo pertinente senza riscrivere silenziosamente la storia.

## Dove risiedono i contratti runtime

- port e servizi applicativi: `packages/core/src/application/`;
- evoluzione schema PostgreSQL: `db/migrations/`;
- ciclo realtime e operatività: `docs/REALTIME_MUTATION_LIFECYCLE.md`;
- portabilità database: `docs/ARCHITECTURAL_PORTABILITY.md`;
- flusso dati frontend: `docs/FRONTEND_DATA_FLOW_STANDARD.md`;
- UX amministrativa e cataloghi semantici:
  `docs/ADMINISTRATIVE_UX_SEMANTIC_CATALOGS.md`;
- guardrail composizione route: `packages/web/src/server/ArchitectureCompliance.test.ts`;
- parità adapter: `packages/core/src/infrastructure/PersistenceAdapterParityPostgres.test.ts`
  e `e2e/admin-adapter-parity.spec.ts`;
- tempi runtime: `packages/web/src/config/runtimeTiming.ts` e il seed/migrations
  della configurazione `session.idleTimeoutSeconds`.

## Edizioni linguistiche

I documenti operativi e tecnici correnti sono pubblicati in edizioni italiana e
inglese abbinate. Un file può conservare un percorso senza suffisso per
compatibilità con i link esistenti; la versione inglese abbinata usa il suffisso
`.en.md` e la versione italiana il suffisso `.it.md`, oppure il percorso definito
negli indici `docs/README.md` e `docs/README.en.md`. Non scrivere prosa mista in
una nuova edizione. Identificativi tecnici, blocchi di codice, route e chiavi di
configurazione non si traducono.

Quando cambia un contratto normativo, aggiornare entrambe le edizioni nella
stessa modifica ed eseguire il controllo dei link. Una traduzione deve
conservare comandi, invarianti, avvisi di sicurezza, differenze tra adapter e
limiti operativi: una sintesi non sostituisce l'edizione normativa.

Requisiti storici, bozze, ADR e analisi datate sono archivi locali privati,
esclusi da Git e non devono essere collegati dalla documentazione corrente. Lo
schema PostgreSQL eseguibile resta l'unica eccezione versionata sotto
`Specifiche/`.
