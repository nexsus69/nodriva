# Consolidamento recovery e verifiche CI — 2026-09-08

Intervento autorizzato dopo l'analisi: correggere autorizzazione transazionale
recovery, classificazione degli errori e lacune CI realtime/backup.

Piano e confini:

- owner autorizzazione: `AccountRecoveryApplicationService`; port ACL e
  transazione esistenti, nessuna nuova policy negli adapter;
- call site: emissione/completamento in `accountRecoveryActions`; mapper Web
  condiviso con contesto pubblico esplicito;
- parità: regressioni con persistenza reale PostgreSQL/SQLite su revoca prima
  della transazione, rollback e retry; test unitari del confine Web;
- CI: riuso di PostgreSQL/Soketi e delle procedure di backup/restore esistenti
  con fixture isolate; browser con due sessioni e ricezione websocket provata;
- verifica: check Core/Web, integrazioni isolate, parità E2E, realtime e restore;
- rischio principale: test falsamente verdi grazie a polling o reload; il test
  realtime deve osservare eventi websocket e aggiornamenti senza navigazione;
- nessuna migrazione, modifica a credenziali operative, commit o push.

Il contratto corrente recovery è in `SECURITY_OPERATIONS.md`.

Esito:

- emissione recovery: authority e destinatario sono letti nel confine
  transazionale; rollback e retry sono provati con SQLite e PostgreSQL;
- completamento pubblico: token, validazione e guasto inatteso hanno messaggi
  distinti e sicuri; la bozza resta disponibile dopo il guasto;
- CI: snapshot/restore SQLite, backup/restore PostgreSQL e profili browser
  `parity` e `realtime`; quest'ultimo osserva websocket, outbox e refresh del
  secondo browser senza navigazione;
- eseguiti localmente: `pnpm check`, `pnpm test:postgres:local` con i contract
  recovery, restore PostgreSQL, parità browser e realtime su Soketi isolato.
