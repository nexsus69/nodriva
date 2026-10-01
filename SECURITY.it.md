# Policy di sicurezza

[Italiano](SECURITY.it.md) | [English](SECURITY.md)

Non aprire issue pubbliche per vulnerabilità, credenziali esposte o configurazioni
sensibili. Usare il canale privato GitHub Security Advisory o contattare il
maintainer privatamente con il minimo necessario.

Includere versione/commit, riproduzione, impatto e mitigazioni applicate. Non
allegare dati di produzione, password, chiavi, token, dump o payload di allegati.

Il ramo supportato è `main`. Un problema confermato richiede fix privato, test
di regressione quando possibile e disclosure coordinata dopo un aggiornamento
sicuro.

Gli operatori proteggono secret e backup e scelgono/hardening/monitoraggio dei
servizi esterni. Non committare `.env`, chiavi private, dump o archivi. Vedere
[gestione segreti](docs/SECRET_MANAGEMENT.md) e
[backup/restore](docs/BACKUP_RESTORE.md).
