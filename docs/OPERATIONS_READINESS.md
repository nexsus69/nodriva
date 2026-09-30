# Operational readiness

Questo runbook verifica il profilo Compose di riferimento/test. Non certifica
un deployment generico e non sostituisce healthcheck, backup, alert o procedure
del provider scelto dall'operatore.

Per SQLite o PostgreSQL avviati direttamente con Node.js, vedere invece
[installazione](INSTALLATION.md), [primo utilizzo](FIRST_RUN.md) e
[runbook Node.js](NODE_OPERATIONS.md), senza richiedere container Docker.

## Healthcheck

La verifica non modifica dati e controlla endpoint applicativo, stato dei
container del riferimento Compose, healthcheck Docker e disponibilità
PostgreSQL. Backup verificato e target Prometheus sono controllati solo se i
rispettivi overlay Compose sono selezionati:

```bash
./scripts/stack-healthcheck.sh
```

L'URL pubblico è obbligatorio e coincide con quello configurato nel deployment:

```bash
DASHBOARD_PUBLIC_URL=https://dashboard.example.com ./scripts/stack-healthcheck.sh
```

Il progetto Compose predefinito è `nodriva`; usare
`NODRIVA_COMPOSE_PROJECT` se il deployment ha un nome differente. Il backup
verificato può avere al massimo 93600 secondi (26 ore); la soglia è regolabile
con `BACKUP_MAX_AGE_SECONDS` in base alla RPO del deployment. Per rendere
obbligatorie le verifiche dei servizi opzionali, passare gli stessi profili del
deploy:

```bash
DASHBOARD_COMPOSE_INTEGRATIONS=realtime,antivirus,monitoring,backup \
  ./scripts/stack-healthcheck.sh
```

Con `backup` il controllo fallisce se `last-status.json` non è completato o è
troppo vecchio; con `monitoring` se Prometheus non è pronto oppure il target è
`down`. Senza quei profili l'assenza dei relativi container è normale. Per
provider remoti usare i loro healthcheck e il catalogo Admin: questo script è
intenzionalmente limitato ai container locali Compose.

## Baseline di rilascio servizi

La baseline del 2026-09-02 valida il profilo PostgreSQL base senza integrazioni
e quello completo con `realtime`, `antivirus`, `monitoring` e `backup`, oltre
alla parità SQLite/PostgreSQL. Nel riferimento Compose gli overlay selezionati
possono essere dichiarati per l'healthcheck con
`DASHBOARD_COMPOSE_INTEGRATIONS`; questa variabile non appartiene al runtime
Nodriva né al profilo SQLite standalone.

Il contratto `pnpm test:compose`, eseguito in CI, verifica che lo stack base
si renderizzi senza secret realtime e che l'attivazione esplicita includa tutti
i servizi opzionali. Non avvia container: il boot completo resta una verifica
operativa isolata. Per servizi esterni, la verifica operativa appartiene al
relativo provider/orchestratore; Nodriva non richiede Docker né un timer
systemd per funzionare.

## Verifiche CI isolate

La CI esegue integrazioni e contract PostgreSQL con ruolo ristretto, restore
PostgreSQL in database temporaneo e snapshot/restore SQLite sullo schema
applicativo. Il job browser ha due profili: `parity` mantiene realtime
esplicitamente disabilitato e include il recovery con errore audit e retry;
`realtime` usa Soketi con credenziali di test e `pnpm e2e:realtime`.
Quest'ultimo verifica frame websocket di acquisizione/rilascio lock, aggiornamento
di un nodo nella seconda sessione senza reload, pubblicazione outbox e
protezione dell'endpoint worker. La sola comparsa di una modifica dopo polling
non soddisfa il test realtime.

Le verifiche CI non certificano HTTPS, antivirus, alert esterni o un recovery
coordinato degli allegati e delle chiavi nel deployment di destinazione.

## Backup e restore verificato

Il backup è considerato valido solo dopo un restore in un database temporaneo:

```bash
./scripts/postgres-backup-verify.sh backup-verify
```

La procedura non sovrascrive mai il database operativo: il restore automatico
usa un database usa-e-getta con marcatore `test`. Il job schedulato nel
container `backup` mantiene il lock di manutenzione, la retention e il file di
stato. Lo stack healthcheck valida `last-status.json`; il deployment deve
comunque configurare un alert autonomo quando lo stato non è `completed` o il
backup verificato supera la RPO concordata.

## Checklist prima del rilascio

- `./scripts/stack-healthcheck.sh` completato;
- backup e restore verificato completati, se il deployment offre backup;
- `pnpm check` completato;
- job CI `PostgreSQL integration and adapter parity` completato senza test
  saltati;
- `pnpm e2e:full` completato con fixture isolate e realtime; predisporre il
  database PostgreSQL di test come descritto in
  [DEVELOPMENT_WORKFLOW.md](DEVELOPMENT_WORKFLOW.md), senza credenziali operative;
- `pnpm e2e:parity` completato contro il database PostgreSQL di test e un
  database SQLite temporaneo; include pannello admin e verticale canonica;
- per lo standalone: `DATABASE_ADAPTER=sqlite` e
  `SQLITE_DATABASE_PATH` valorizzati, build Web e smoke HTTP completati;
- chiavi e password fornite da secret manager, mai da file versionati;
- proxy HTTPS configurato per ambienti non locali;
- log, metriche/alerting verificati quando l'osservabilità è abilitata;
- sessioni browser di test chiuse e nessun lock residuo nel database;
- procedura di rollback documentata e backup corrente disponibile.

Il profilo Compose completo è pensato per sviluppo, dimostrazione e test
replicabile e non e' una soluzione production-ready universale. Un deployment
operativo deve essere progettato e validato dall'operatore, inclusi secret,
HTTPS, disponibilita', retention, replica, monitoraggio e recovery.
