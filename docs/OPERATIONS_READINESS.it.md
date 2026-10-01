# Prontezza operativa

Prima del rilascio verificare build, migrazioni su schema vuoto e upgrade,
healthcheck, metriche, backup/restore, secret e runbook. Eseguire i test
PostgreSQL, parità SQLite/PostgreSQL, E2E canonico e test di concorrenza.

Registrare limiti residui, owner e piano di mitigazione; una compilazione verde
da sola non costituisce readiness.
