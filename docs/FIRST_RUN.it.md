# Primo avvio

Preparare `.env` fuori dal repository, scegliere il profilo SQLite o PostgreSQL
e avviare migrazioni/bootstrap secondo `INSTALLATION.md`. Il bootstrap è
idempotente e crea soltanto il catalogo minimo richiesto.

Accedere con l'amministratore iniziale, verificare tipi, campi e ruoli, creare
un utente operativo e completare il percorso demo. In caso di errore controllare
healthcheck, log e variabili senza esporre segreti.
