# Governance architetturale

Questo documento e' normativo insieme ad `ARCHITECTURE.md`. Una modifica che
viola queste regole non e' pronta per il merge, anche se compila.

## Regole vincolanti

1. **Una policy, un owner.** Autorizzazione, ownership dei lock, concorrenza,
   deletion policy e cifratura sono definite una sola volta nel Domain o
   Application. Gli adapter traducono il contratto e non introducono criteri
   alternativi.
2. **Contratti completi.** Un port deve ricevere tutte le informazioni della
   policy. L'owner di un lock e' sempre `(userId, sessionId)`, mai il solo
   utente.
3. **Mutazioni atomiche.** `rowVersion`, lock, ACL e restrict sono verificati
   nella stessa transazione e, quando condizionano una write, nella stessa
   operazione atomica.
4. **Parita' adapter.** PostgreSQL e SQLite possono differire internamente ma
   devono produrre stessi esiti, errori, ordinamenti, rollback e vincoli.
5. **Deployment non e' prodotto.** Compose, systemd, CI e host locali non
   definiscono policy Nodriva e non sono requisiti impliciti del runtime.
6. **Suite completa in locale.** Prima di dichiarare concluso un intervento e
   prima di ogni push devono essere eseguiti localmente tutti i test pertinenti,
   inclusi integrazioni PostgreSQL, contract, parity adapter ed E2E. I test
   PostgreSQL usano esclusivamente il database isolato creato da
   `pnpm test:postgres:local`; uno skip dovuto a configurazione mancante non è
   considerato un esito valido.

## Checklist obbligatoria

### SQLite connection ownership

`SqliteDatabase` owns the single-connection asynchronous access queue. Every
asynchronous adapter method and every application transaction enters that same
reentrant queue. Synchronous adapter helpers may run only while the connection
is idle or in its owning asynchronous context; an unrelated synchronous access
fails before executing SQL. Ownership expires when work completes, including
for detached callbacks. After-commit effects run after releasing ownership.
This protects sessions, workers and reads as well as ordinary mutations.

### Attachment mutation ownership

`AttachmentApplicationService` owns attachment upload and deletion in the
Entity/Governance application boundary. It depends on application ports and
the existing lock policy, never HTTP or SQL. Commands carry authenticated
user/session identity and the expected aggregate version. With locking enabled,
an existing resource requires an owned lock, including uploads immediately after
creation (the client acquires and releases that lock explicitly).

Blob staging/scanning precedes the final transaction. That transaction repeats
ACL, field and security-policy checks, verifies lock ownership and conditionally
advances the aggregate version, then persists attachment metadata, audit and
realtime outbox together. A changed security policy rejects the staged upload.
Blob cleanup and delivery occur after commit. Responses return the resulting
aggregate version so multiple uploads can chain conditional writes without
silently refreshing away a stale form. Routes only decode HTTP and map outcomes.

Per ogni modifica dichiarare policy owner, port, call site, adapter e test di
parita'. Prima del merge verificare call site indiretti, test negativi di
divergenza, rollback e `git diff --check`.

## Protocollo di chiusura audit

Un rilievo audit trasversale non puo' passare a "Risolto" solo perche' il caso
principale funziona. La chiusura richiede:

- owner applicativo esplicito della policy;
- port completo, senza parametri mancanti che costringano gli adapter a
  reinterpretare la regola;
- tutti i call site noti aggiornati o dichiarati non coinvolti;
- parita' osservabile PostgreSQL/SQLite quando il comportamento e' comune;
- almeno un test negativo che fallisce se ricompare la vecchia deviazione;
- aggiornamento dei documenti normativi interessati con criterio ed esito.

Se una policy resta duplicata in piu' punti, il rilievo resta aperto anche se la
singola schermata o il singolo endpoint sembrano corretti.
