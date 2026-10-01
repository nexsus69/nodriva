# Prontezza operativa

Questo runbook verifica il profilo Compose di riferimento/test. Non certifica
un deployment generico e non sostituisce healthcheck, backup, alert o procedure
del provider scelto dall'operatore.

Per SQLite o PostgreSQL avviati direttamente con Node.js consultare
[installazione](INSTALLATION.md), [primo utilizzo](FIRST_RUN.md) e [runbook
Node.js](NODE_OPERATIONS.md), senza richiedere container Docker.

## Healthcheck

La verifica non modifica dati e controlla endpoint applicativo, stato dei
container del riferimento Compose, healthcheck Docker e disponibilità
PostgreSQL. Backup verificato e target Prometheus sono controllati solo quando
i rispettivi overlay Compose sono selezionati:

```bash
./scripts/stack-healthcheck.sh
```

L'URL pubblico è obbligatorio e coincide con quello configurato nel deployment:

```bash
DASHBOARD_PUBLIC_URL=https://dashboard.example.com ./scripts/stack-healthcheck.sh
```

Il progetto Compose predefinito è `nodriva`; usare `NODRIVA_COMPOSE_PROJECT` se
il deployment ha un nome differente. Il backup verificato può avere al massimo
93600 secondi (26 ore); regolare la soglia con `BACKUP_MAX_AGE_SECONDS` in base
alla RPO. Per rendere obbligatorie le verifiche dei servizi opzionali, passare
gli stessi profili del deployment:

```bash
DASHBOARD_COMPOSE_INTEGRATIONS=realtime,antivirus,monitoring,backup \
  ./scripts/stack-healthcheck.sh
```

Con `backup` il controllo fallisce se `last-status.json` non è completato o è
troppo vecchio; con `monitoring` se Prometheus non è pronto o il target è
`down`. Senza quei profili l'assenza dei container è normale. Per provider
remoti usare i loro healthcheck e il catalogo Admin: questo script è limitato
intenzionalmente ai container locali Compose.

## Baseline di rilascio servizi

La baseline del 2026-09-02 valida il profilo PostgreSQL base senza integrazioni e
quello completo con `realtime`, `antivirus`, `monitoring` e `backup`, oltre alla
parità SQLite/PostgreSQL. Nel riferimento Compose gli overlay selezionati
possono essere dichiarati tramite `DASHBOARD_COMPOSE_INTEGRATIONS`; la variabile
non appartiene al runtime Nodriva né al profilo SQLite standalone.

Il contratto `pnpm test:compose`, eseguito in CI, verifica che lo stack base si
renderizzi senza secret realtime e che l'attivazione esplicita includa tutti i
servizi opzionali. Non avvia container: il boot completo resta una verifica
operativa isolata. Per servizi esterni, la verifica appartiene al relativo
provider/orchestratore; Nodriva non richiede Docker né uno scheduler del sistema
operativo.

## Verifiche CI isolate

La CI esegue integrazioni e contract PostgreSQL con ruolo ristretto, restore
PostgreSQL in database temporaneo e snapshot/restore SQLite sullo schema
applicativo. Il job browser ha due profili: `parity` mantiene realtime
disabilitato e include recovery con errore audit e retry; `realtime` usa Soketi
con credenziali di test e `pnpm e2e:realtime`.

Quest'ultimo verifica frame WebSocket di acquisizione/rilascio lock,
aggiornamento di un nodo nella seconda sessione senza reload, pubblicazione
outbox e protezione dell'endpoint worker. La sola comparsa di una modifica dopo
polling non soddisfa il test realtime.

Le verifiche CI non certificano HTTPS, antivirus, alert esterni o recovery
coordinato di allegati e chiavi nel deployment di destinazione.

## Backup e restore verificato

Il backup è valido solo dopo un restore in un database temporaneo:

```bash
./scripts/postgres-backup-verify.sh backup-verify
```

La procedura non sovrascrive il database operativo: il restore usa un database
usa-e-getta con marcatore `test`. Il job nel container `backup` mantiene lock di
manutenzione, retention e file di stato. Lo stack healthcheck valida
`last-status.json`; il deployment deve comunque configurare un alert autonomo
quando lo stato non è `completed` o il backup supera la RPO.

## Checklist prima del rilascio

- `./scripts/stack-healthcheck.sh` completato;
- backup e restore verificato completati, se offerti dal deployment;
- `pnpm check` completato;
- job CI `PostgreSQL integration and adapter parity` completato senza skip;
- `pnpm e2e:full` completato con fixture isolate e realtime; predisporre il
  database PostgreSQL di test come descritto in
  [DEVELOPMENT_WORKFLOW.md](DEVELOPMENT_WORKFLOW.md), senza credenziali operative;
- `pnpm e2e:parity` completato contro PostgreSQL di test e SQLite temporaneo,
  includendo pannello Admin e verticale canonica;
- per standalone, `DATABASE_ADAPTER=sqlite` e `SQLITE_DATABASE_PATH` valorizzati,
  build Web e smoke HTTP completati;
- chiavi e password fornite da secret manager, mai da file versionati;
- proxy HTTPS configurato per ambienti non locali;
- log e metriche/alerting verificati quando l'osservabilità è abilitata;
- sessioni browser di test chiuse e nessun lock residuo;
- procedura rollback documentata e backup corrente disponibile.

Il profilo Compose completo è pensato per sviluppo, dimostrazione e test
replicabile, non è una soluzione production-ready universale. Un deployment
operativo deve essere progettato e validato dall'operatore, inclusi secret,
HTTPS, disponibilità, retention, replica, monitoraggio e recovery.
