# Flusso di sviluppo

## Gate prima del push

Prima di ogni push verso un branch condiviso è obbligatorio eseguire il gate
locale completo:

```bash
pnpm verify:push
```

`pnpm verify:push` esegue:

- validazione della documentazione sorgente;
- typecheck Core e Web;
- lint Core e Web;
- suite di test Core e Web;
- build production di Core e Web;
- suite completa PostgreSQL di integrazione, contract e parità su un database
  locale isolato (`pnpm test:postgres:local`);
- suite E2E di parità browser per SQLite e PostgreSQL (`pnpm e2e:parity`).

Un push non è pronto se una parte del comando fallisce, anche quando test
mirati, typecheck, lint o un singolo scenario E2E passano. Il database
PostgreSQL di test viene creato e distrutto dallo script dedicato; non si usano
database operativi o di sviluppo.

Questo documento è il contratto del repository per il controllo locale prima del
push. La CI esegue gli stessi controlli in job isolati e verifica inoltre
realtime e backup/restore. Prima di una release eseguire localmente anche tali
controlli operativi con risorse isolate, come descritto in
`OPERATIONS_READINESS.md`.

## Controlli aggiuntivi nel database locale isolato

`scripts/postgres-test-local.sh` accetta un comando opzionale, eseguito solo
dopo il successo della suite PostgreSQL e prima del teardown. Il comando eredita
le URL di test e può verificare restore o browser nello stesso ambiente:

```bash
pnpm test:postgres:local bash /percorso/controlli-isolati.sh
```

Il comando aggiuntivo non sostituisce le integrazioni; un suo errore si propaga
e il database temporaneo viene comunque eliminato. Per i browser passare le
connessioni e il nome del database di test tramite
`PARITY_POSTGRES_ADMIN_URL`, `PARITY_POSTGRES_APP_URL` e
`PARITY_POSTGRES_TEMPLATE_DATABASE`; non usare il fallback che legge il
deployment locale. `pnpm e2e:realtime` richiede un Soketi di test configurato
tramite le variabili Pusher esistenti e `REALTIME_WORKER_SECRET`. Non abilitare
`PARITY_SKIP_BUILD` passando da un profilo all'altro: le variabili pubbliche
realtime sono fissate dalla build.
