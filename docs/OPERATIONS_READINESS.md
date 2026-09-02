# Operational readiness

## Healthcheck

La verifica non modifica dati e controlla endpoint applicativo, stato dei
container del riferimento Compose, healthcheck Docker e disponibilità
PostgreSQL. Backup verificato e target Prometheus sono controllati solo se i
rispettivi profili sono selezionati:

```bash
./scripts/stack-healthcheck.sh
```

Per un proxy o un host diverso:

```bash
DASHBOARD_BASE_URL=http://192.168.3.247:3001 ./scripts/stack-healthcheck.sh
```

Il progetto Compose predefinito è `dashboard_ultimate`; usare
`DASHBOARD_COMPOSE_PROJECT` se il deployment ha un nome differente. Il backup
verificato può avere al massimo 93600 secondi (26 ore); la soglia è regolabile
con `BACKUP_MAX_AGE_SECONDS` in base alla RPO del deployment. Per rendere
obbligatorie le verifiche dei servizi opzionali, passare gli stessi profili del
deploy:

```bash
DASHBOARD_COMPOSE_PROFILES=realtime,antivirus,monitoring,backup \
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
alla parità SQLite/PostgreSQL. Nel riferimento Compose il profilo operativo può
essere dichiarato nel file di deployment con `NODRIVA_COMPOSE_PROFILES`; non
viene dedotto dai container già in esecuzione. Questa variabile non appartiene
al runtime Nodriva né al profilo SQLite standalone.

Il contratto `pnpm test:compose`, eseguito in CI, verifica che il profilo base
si renderizzi senza secret realtime e che l'attivazione esplicita includa tutti
i servizi opzionali. Non avvia container: il boot completo resta una verifica
operativa isolata. Per servizi esterni, la verifica operativa appartiene al
relativo provider/orchestratore; Nodriva non richiede Docker né un timer
systemd per funzionare.

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
- `E2E_RUN=true E2E_EMAIL=... E2E_PASSWORD=... E2E_USER_ID=... pnpm e2e`
  completato con due contesti Chromium autenticati;
- `pnpm e2e:parity` completato contro il database PostgreSQL di test e un
  database SQLite temporaneo; include pannello admin e verticale canonica;
- per lo standalone: `DATABASE_ADAPTER=sqlite` e
  `SQLITE_DATABASE_PATH` valorizzati, build Web e smoke HTTP completati;
- chiavi e password fornite da secret manager, mai da file versionati;
- proxy HTTPS configurato per ambienti non locali;
- log, metriche/alerting verificati quando l'osservabilità è abilitata;
- sessioni browser di test chiuse e nessun lock residuo nel database;
- procedura di rollback documentata e backup corrente disponibile.

Il compose completo è pensato per sviluppo e staging replicabile. Per
produzione è necessario sostituire i valori di sviluppo con segreti gestiti,
abilitare HTTPS e definire retention, replica e monitoraggio esterni.
