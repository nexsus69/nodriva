# Modello di deployment

Nodriva supporta il profilo standalone SQLite e il profilo completo PostgreSQL.
Il primo richiede Node.js e un file locale; il secondo può integrare realtime,
worker outbox, antivirus, metriche, backup e proxy secondo la configurazione.

Compose è un profilo di riferimento/test. Per una modifica applicativa
ricostruire e riavviare soltanto il servizio coinvolto; usare un deploy completo
solo quando cambiano configurazioni o dipendenze condivise.
