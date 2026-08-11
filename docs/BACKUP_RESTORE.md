# Backup e restore PostgreSQL

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

## Creazione e verifica

```bash
./scripts/postgres-backup-verify.sh backup-verify
```

Il comando crea un file in `var/backups/postgres/`, il relativo `.sha256`,
valida la leggibilità dell’archivio e ripristina il dump in un database
temporaneo. Al termine il database temporaneo viene eliminato.

Per usare un percorso esplicito:

```bash
./scripts/postgres-backup-verify.sh backup-verify /secure/backups/dashboard-$(date -u +%Y%m%d).dump
```

Per verificare un archivio già prodotto:

```bash
./scripts/postgres-backup-verify.sh verify /secure/backups/dashboard-20260811.dump
sha256sum --check /secure/backups/dashboard-20260811.dump.sha256
```

La verifica controlla anche la presenza e la interrogabilità delle tabelle
principali (`users`, `nodes`, `entities`, tipi, audit, realtime, allegati e
cifratura campi).

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

La procedura non automatizza il punto 5 per evitare un overwrite distruttivo
del database operativo tramite un comando eseguito per errore.

## Frequenza e retention

Il backup deve essere schedulato esternamente con retention, copia fuori host,
monitoraggio degli errori e alert sull’assenza dell’ultimo backup verificato.
Un backup è considerato valido solo se il restore temporaneo è riuscito; la
sola presenza del file non è sufficiente.
