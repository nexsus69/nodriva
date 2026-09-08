# Backup e restore verificato

## SQLite standalone

Il profilo SQLite usa `node scripts/sqlite-backup-verify.mjs backup-verify`.
Lo script crea uno snapshot consistente con `VACUUM INTO`, calcola SHA-256,
lo copia in un percorso temporaneo di restore e vi esegue `PRAGMA integrity_check`.
Il manifest JSON riporta provider, checksum, dimensione, versione schema e
`restoreVerification: passed`. Non sovrascrive mai il database operativo.

Per lo scheduling standalone usare `node scripts/sqlite-backup-maintenance.mjs`.
Il wrapper applica lock esclusivo, retention e `last-status.json`, e rispetta
la policy runtime `backup.scheduledEnabled`. Lo scheduler concreto resta una
decisione del deployment (systemd, cron o provider gestito).

La procedura ufficiale usa `pg_dump` in formato custom, checksum SHA-256 e un
restore di verifica in un database temporaneo. Il database operativo non è mai
una destinazione del comando `verify`.

## Prerequisiti

- container PostgreSQL operativo (`dashboard-db-pg17` per la configurazione
  locale);
- `docker`, `pg_restore` e `sha256sum` disponibili sull’host;
- spazio sufficiente per almeno due copie del database durante la verifica;
- directory di backup protetta e inclusa nella strategia di cifratura e replica
  dell’infrastruttura.

Il dump contiene dati applicativi, audit e potenziali valori sensibili. Deve
essere trattato come un secret: permessi `0600`, cifratura a riposo e accesso
limitato agli operatori autorizzati.

## Recovery completo: database, allegati e chiavi

Database, payload degli allegati e keyring sono tre artefatti coordinati. I
manifest di PostgreSQL e SQLite indicano esplicitamente che i payload e le
chiavi sono dipendenze di recovery: non li archiviano né li espongono.

L’operatore deve conservare, con lo stesso punto di ripristino, la copia del
filesystem/mount degli allegati e le versioni delle chiavi di cifratura usate
dal backup. Il restore si verifica prima su una copia temporanea; una perdita
del keyring rende irrecuperabili gli allegati o i campi cifrati anche se il
database è integro.

Il dump PostgreSQL include i record e i metadati degli allegati, non i payload
nel volume `dashboard_full_attachments`. Quel volume deve essere protetto con
backup e replica dell'infrastruttura, coordinati con il dump database. La
procedura applicativa non introduce deliberatamente un secondo formato di
archivio per gli allegati.

## Creazione e verifica

```bash
./scripts/postgres-backup-verify.sh backup-verify
```

Il comando crea un file in `var/backups/postgres/`, il relativo `.sha256`,
verifica il checksum, valida la leggibilità dell’archivio e ripristina il dump
in un database temporaneo il cui nome contiene sempre `test`. Al termine il
database temporaneo viene eliminato anche quando una verifica fallisce.
La verifica interroga esclusivamente lo snapshot ripristinato: non confronta i
conteggi con il database operativo corrente, che può essere cambiato dopo la
creazione del dump. Controlla invece schema richiesto, leggibilità delle tabelle
e integrità strutturale dell'archivio.

Per usare un percorso esplicito:

```bash
./scripts/postgres-backup-verify.sh backup-verify /secure/backups/dashboard-$(date -u +%Y%m%d).dump
```

Per verificare un archivio già prodotto:

```bash
./scripts/postgres-backup-verify.sh verify /secure/backups/dashboard-20260811.dump
```

Il file `.sha256` affiancato è obbligatorio anche per `verify`: un checksum
mancante, malformato o non corrispondente interrompe la procedura prima del
restore. La verifica controlla inoltre la presenza e l'interrogabilità delle
tabelle principali e confronta fra sorgente e copia ripristinata i conteggi di
utenti, nodi, entità, tipi, audit, allegati, cifratura campi e outbox realtime.

## Restore operativo

Il restore verso il database operativo è deliberatamente manuale e richiede
una finestra di manutenzione, perché sostituisce lo stato corrente. Prima di
procedere:

1. fermare il Web e i worker che scrivono sul database;
2. eseguire un nuovo backup dell’istanza corrente;
3. verificare checksum e restore in database temporaneo;
4. concordare il database target e la perdita dati accettata;
5. eseguire `pg_restore` solo con credenziali amministrative e con log
   conservati;
6. riavviare i servizi e verificare login, ACL, audit, allegati, cifratura e
   realtime.

Se il deployment usa allegati, ripristinare il volume dalla copia coordinata
prima del punto 6 e verificare che ogni record `resource_attachments` abbia il
relativo payload. Un restore del solo database non costituisce disaster
recovery completo per quel deployment.

La procedura non automatizza il punto 5 per evitare un overwrite distruttivo
del database operativo tramite un comando eseguito per errore.

## Frequenza e retention

Il backup deve essere schedulato esternamente con retention, copia fuori host,
monitoraggio degli errori e alert sull’assenza dell’ultimo backup verificato.
Un backup è considerato valido solo se il restore temporaneo è riuscito; la
sola presenza del file non è sufficiente.
