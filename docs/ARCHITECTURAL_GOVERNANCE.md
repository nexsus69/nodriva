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

## Checklist obbligatoria

Prima del codice: dichiarare policy owner, port, call site, adapter e test di
parita'. Prima del merge: verificare call site indiretti, test negativi di
divergenza, rollback e `git diff --check`.
