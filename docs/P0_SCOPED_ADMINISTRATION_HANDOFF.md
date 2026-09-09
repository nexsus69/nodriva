# P0 scoped administration handoff

> **Handoff storico completato.** Questo documento conserva il perimetro
> operativo usato per chiudere il P0; non è una lista di attività corrente. Lo
> stato normativo è in `BACKEND_ALIGNMENT_TODO.md` e `ARCHITECTURE.md`.

Lavora nel workspace corrente: `/home/marco/docker_container/Nodriva`.

## Obiettivo unico

Chiudere completamente il blocco P0 **amministrazione delegata scoped**
descritto in `docs/BACKEND_ALIGNMENT_TODO.md`.

Non lavorare su responsive/UI generale né su altri backlog.

## Stato già implementato

Non rimuovere:

- ACL di copertura per deleghe `self`/`subtree` con deny:
  `AccessControlPort.assertHasPermissionCoverage`.
- Creazione atomica Core `createScopedUser`: utente, scope `allow` e audit
  nella stessa transazione.
- Ruoli globali e modifica del modello dei permessi riservati a superadmin.
- `UserRepositoryPostgres.listUsersManageableBy(actorUserId)`, da
  completare e verificare.
- Lista/dettaglio utenti e lista scope precedentemente messi in fail-closed
  per superadmin fino alle query filtrate.

## Da completare

1. Implementare query PostgreSQL set-based ed efficienti per:
   - lista utenti gestibili dall’admin locale;
   - dettaglio utente gestibile;
   - lista assegnazioni scope gestibili;
   - verifica puntuale che utente o scope siano nel perimetro dell’admin.
2. Applicare queste regole:
   - superadmin vede e gestisce tutto;
   - admin locale vede e gestisce solo utenti le cui assegnazioni rilevanti
     sono interamente nel proprio perimetro delegabile;
   - `self` non autorizza `subtree`;
   - un deny dell’admin esclude l’area;
   - ruoli globali privilegiati restano solo superadmin;
   - nessun filtraggio ACL in memoria: usare query SQL set-based e indici
     adeguati.
3. Collegare `createScopedUserAction` alla UI amministrativa, consentendo a
   un admin locale di creare un utente con uno o più scope delegabili.
4. Creare dati di test puliti e reversibili nel PostgreSQL Docker locale per
   scenari allow, deny, self, subtree, discendenti, scope esterno e
   superadmin.
5. Aggiungere test unitari e di integrazione PostgreSQL per tutti i casi.
6. Eseguire build Core, typecheck/lint/test Web e test Core/Web completi con
   database.
7. Aggiornare `docs/BACKEND_ALIGNMENT_TODO.md` e `ARCHITECTURE.md`; segnare
   P0 completo solo se tutto è implementato e verificato.

## Regole operative

- Non fare commit.
- Non modificare file non pertinenti.
- Non fermarti per aggiornamenti intermedi: lavora fino alla consegna finale.
- Se emerge un blocker reale, fermati solo con evidenza concreta.
- Alla fine riporta file cambiati, comportamento finale, query o indici
  introdotti, test eseguiti e risultati.
