# Migrazioni del database

[Italiano](README.md) | [English](README.en.md)

Applicare le migrazioni nell'ordine dei nomi a un database inizializzato da
`Specifiche/dashboard_v4_schema_corrected.sql`. Schema e migrazioni non creano
il primo amministratore: completare il bootstrap esplicito
`SystemSeedPostgres` nella [guida di installazione](../docs/INSTALLATION.it.md)
prima di avviare il Web. Compose esegue lo stesso passaggio tramite `db-seed`;
nessuno dei due percorsi carica nodi, entità o tipi demo.

La tabella canonica per l'autenticazione è `user_sessions`. La migrazione `009`
converte i token storici, installa il gruppo ristretto `dashboard_app` e rimuove
la tabella precedente. Creare un ruolo LOGIN dedicato appartenente al gruppo,
impostare `REQUIRE_RESTRICTED_DB_ROLE=true` e non collegare mai il Web come
`postgres`.

La migrazione `020` rimuove il DDL generico dal ruolo applicativo ed espone solo
funzioni `SECURITY DEFINER` controllate. Le migrazioni successive aggiungono
metadati delle relazioni, tabelle dinamiche, permessi del cestino, capability
realtime, rotazione della cifratura, configurazione dei servizi e limite di
upload degli allegati. In un upgrade non rieseguire lo schema base: applicare
solo le migrazioni mancanti.

Il bootstrap d'integrazione usa un database vuoto il cui nome contiene `test`,
verifica l'upgrade della tabella storica, riapplica le migrazioni e controlla il
ruolo ristretto. È distruttivo solo per quel database temporaneo e non deve mai
essere usato sul database operativo.

Per la procedura completa e i comandi di verifica consultare la versione
[inglese](README.en.md) e [`docs/BACKUP_RESTORE.it.md`](../docs/BACKUP_RESTORE.it.md).
