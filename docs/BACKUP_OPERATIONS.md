# Esercizio automatico dei backup

Il backup verificato può essere eseguito automaticamente con
`scripts/postgres-backup-maintenance.sh`. Il wrapper:

- impedisce esecuzioni concorrenti con `flock`;
- crea e verifica un backup PostgreSQL;
- applica la retention configurata;
- scrive `last-status.json` con esito e riferimenti ai file;
- restituisce codice diverso da zero in caso di errore, consentendo alert
  tramite systemd, cron o il monitoraggio di sistema.

Nel Compose completo lo stesso wrapper gira nel servizio `backup`, collegato
direttamente a PostgreSQL sulla rete Docker; non richiede accesso al socket
Docker dell’host.

L’amministratore può sospendere lo scheduling da **Platform → Backup**. La
policy runtime `backup.scheduledEnabled` non spegne il servizio del deployment:
il job registra lo stato `paused` e non crea un dump. Un backup manuale
operativo resta possibile; il restore non è esposto dal pannello.

## Configurazione

Variabili disponibili:

```text
BACKUP_ROOT=/secure/backups/dashboard/postgres
BACKUP_RETENTION_DAYS=30
BACKUP_STATUS_FILE=/secure/backups/dashboard/postgres/last-status.json
POSTGRES_CONTAINER=dashboard-db-pg17
POSTGRES_DATABASE=dashboard
POSTGRES_USER=postgres
```

La directory deve essere protetta, cifrata e replicata fuori dall’host. Il
backup contiene dati applicativi e non deve essere esposto tramite il Web.

Per SQLite standalone il comando equivalente è
`node scripts/sqlite-backup-maintenance.mjs`. Produce lo stesso stato
`completed|paused|failed`, applica retention e crea snapshot verificati in una
copia temporanea. `BACKUP_ROOT`, `BACKUP_RETENTION_DAYS` e
`BACKUP_STATUS_FILE` hanno la stessa semantica; impostare inoltre
`SQLITE_DATABASE_PATH` al file operativo.

Il manifest/status contiene provider, formato, checksum, dimensione, esito
del restore di verifica e dipendenze di recovery. Allegati e keyring restano
copie coordinate gestite dal deployment, non dati esposti dall’applicazione.

## Systemd

I template si trovano in `ops/systemd/`. Dopo aver sostituito il percorso del
progetto e creato `/etc/dashboard/dashboard-backup.env` con permessi `0600`:

```bash
sudo install -m 0644 ops/systemd/dashboard-postgres-backup.service /etc/systemd/system/
sudo install -m 0644 ops/systemd/dashboard-postgres-backup.timer /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now dashboard-postgres-backup.timer
systemctl list-timers dashboard-postgres-backup.timer
```

Verifica e alert:

```bash
systemctl status dashboard-postgres-backup.service
cat /secure/backups/dashboard/postgres/last-status.json
journalctl -u dashboard-postgres-backup.service
```

Un’installazione professionale deve collegare il fallimento del service a un
alerting esterno e controllare anche la data di `completedAt`, lo spazio disco
e la presenza della copia fuori host.

## Cron alternativo

Se systemd non è disponibile, eseguire il wrapper da cron con l’ambiente
esplicito e redirigere stdout/stderr verso il sistema di log. Il wrapper
mantiene comunque lock, retention e stato.
