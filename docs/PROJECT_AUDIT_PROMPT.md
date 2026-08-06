# Prompt per audit completo del progetto

```text
Analizza integralmente il repository `/home/marco/docker_container/dashboard_ultimate` come una code review tecnica e operativa prima di iniziare P3.

Contesto:
- Stack: monorepo pnpm, Core TypeScript, Next.js Web, PostgreSQL Docker, Soketi/Pusher-compatible realtime, worker outbox e Prometheus opzionale.
- Gli ultimi commit principali sono:
  - `f460812 feat: close delegated administration and realtime operations`
  - `e21de51 feat: harden ACL and administrative identities`
  - `37443a3 fix: harden scoped administration workflows`
- Le migrazioni DB fino a `008` sono state applicate al PostgreSQL Docker.
- P2 è stato dichiarato chiuso, ma la UI pubblica per consumare token invito/reset e l’enrollment/verifica TOTP MFA potrebbero essere solo parzialmente implementati: verifica, non assumere.
- Esistono account locali `scope-test-*` usati per collaudo ACL; non eliminarli senza autorizzazione.

Obiettivo:
Trova errori reali, incoerenze, regressioni, problemi di sicurezza, performance, UX, architettura, migrazioni e operatività. Non implementare modifiche inizialmente: produci prima un report evidence-based.

Procedura obbligatoria:
1. Leggi integralmente:
   - `docs/BACKEND_ALIGNMENT_TODO.md`
   - `docs/ARCHITECTURAL_PORTABILITY.md`
   - `docs/SECURITY_OPERATIONS.md`
   - `docs/P0_SCOPED_ADMINISTRATION_HANDOFF.md`
   - `db/README.md`
2. Controlla lo stato Git e segnala eventuali modifiche non committate.
3. Esegui, senza modificare dati:
   - test completi Core;
   - typecheck e lint Web;
   - build Web se praticabile;
   - verifica Docker (`docker compose ps`);
   - verifica migrazioni/schema PostgreSQL e salute di worker/realtime.
4. Ispeziona in particolare:
   - ACL allow/deny, scope subtree/self, utenti delegati, super-admin;
   - query PostgreSQL e alias/parametri SQL;
   - coerenza fra enum del codice e enum DB;
   - migrazioni idempotenti e compatibili con schema iniziale;
   - ruoli baseline `default_reader`, `scoped_reader`, `admin`;
   - creazione/disabilitazione utenti, sessioni, audit;
   - inviti/reset/rate limit/MFA: verifica che siano davvero esposti e utilizzabili end-to-end;
   - lock: assenza di N+1, cache e realtime;
   - worker outbox, Pusher/Soketi e Prometheus opzionale;
   - confini ports/adapters e dipendenze PostgreSQL-specifiche;
   - error handling delle Server Actions;
   - responsive UI e debug overlay sentinel.
5. Distingui sempre tra:
   - bug confermato;
   - rischio concreto;
   - debito tecnico;
   - osservazione non riproducibile.
6. Per ogni problema indica:
   - severità: bloccante / alta / media / bassa;
   - file e riga coinvolti;
   - prova o comando che lo dimostra;
   - impatto;
   - correzione proposta;
   - eventuale test da aggiungere.
7. Non fare commit, non applicare migrazioni e non modificare file senza una mia autorizzazione esplicita.

Concludi con:
- una tabella prioritaria dei problemi;
- una proposta ordinata di backlog P3;
- il minimo set di interventi necessario prima di considerare il progetto pronto per un ambiente di test condiviso.
```
