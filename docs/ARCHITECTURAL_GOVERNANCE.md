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
6. **Piano concordato prima dell'implementazione.** Per ogni intervento non
   banale il lavoro deve iniziare con un piano scritto che dichiari obiettivo,
   perimetro, file o moduli coinvolti, strategia, test e criteri di chiusura.
   L'implementazione può iniziare solo dopo la conferma esplicita del piano.
   Una richiesta successiva di modifica richiede l'aggiornamento del piano
   prima di proseguire.
7. **Suite completa in locale.** Prima di dichiarare concluso un intervento e
   prima di ogni push devono essere eseguiti localmente tutti i test pertinenti,
   inclusi integrazioni PostgreSQL, contract, parity adapter ed E2E. I test
   PostgreSQL usano esclusivamente il database isolato creato da
   `pnpm test:postgres:local`; uno skip dovuto a configurazione mancante non è
   considerato un esito valido.

## Checklist obbligatoria

 Prima del codice: concordare e registrare il piano, dichiarare policy owner,
 port, call site, adapter e test di parita'. Prima del merge: verificare call
 site indiretti, test negativi di divergenza, rollback e `git diff --check`.

## Protocollo di chiusura audit

Un rilievo audit trasversale non puo' passare a "Risolto" solo perche' il caso
principale funziona. La chiusura richiede:

- owner applicativo esplicito della policy;
- port completo, senza parametri mancanti che costringano gli adapter a
  reinterpretare la regola;
- tutti i call site noti aggiornati o dichiarati non coinvolti;
- parita' osservabile PostgreSQL/SQLite quando il comportamento e' comune;
- almeno un test negativo che fallisce se ricompare la vecchia deviazione;
- aggiornamento di `docs/NODRIVA_AUDIT_REMEDIATION_TRACKER.md` con criterio e
  stato.

Se una policy resta duplicata in piu' punti, il rilievo resta aperto anche se la
singola schermata o il singolo endpoint sembrano corretti.

## Registro verifiche

Le verifiche tecniche periodiche devono essere registrate in `docs/` senza
riscrivere l'audit storico. La verifica corrente e':

- `docs/ARCHITECTURAL_GOVERNANCE_AUDIT_2026-09-05.md`
