# Backup e ripristino

Prima del ripristino fermare le scritture, verificare l'integrità della copia e
preparare un database PostgreSQL di test. Applicare migrazioni/bootstrap,
ripristinare i dati, controllare audit, outbox e vincoli di scope, quindi
eseguire i test della verticale canonica.

Per SQLite usare una copia consistente del file e validare i permessi. Il
ripristino in produzione richiede una finestra approvata e un piano di rollback.
