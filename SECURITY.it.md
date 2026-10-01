# Policy di sicurezza

[Italiano](SECURITY.it.md) | [English](SECURITY.md)

## Segnalare una vulnerabilità

Non aprire issue pubbliche per vulnerabilità sospette, esposizione di
credenziali o problemi di configurazione sensibili. Segnalare tramite il canale
privato GitHub Security Advisory del repository. Se non è disponibile,
contattare privatamente il maintainer via GitHub e includere solo le
informazioni minime necessarie a stabilire il contatto.

Fornire descrizione concisa, versione o commit interessato, passi di
riproduzione, impatto e mitigazioni già applicate. Non allegare dati di
produzione, password, chiavi private, token di accesso, dump database o payload
di allegati.

## Perimetro e risposta

La linea di codice supportata è il branch `main`. I report vengono sottoposti a
triage senza SLA. Un problema confermato viene gestito con fix privato, test di
regressione quando possibile e nota di disclosure coordinata dopo la
disponibilità di un aggiornamento sicuro.

## Operatori del deployment

Gli operatori sono responsabili della protezione di secret e backup specifici
del deployment e della scelta, messa in sicurezza e osservabilità dei servizi
esterni. Il progetto non gestisce il deployment e non offre SLA. Non committare
mai `.env` valorizzati, file `.env.*`, chiavi private, dump database o archivi
di backup.

Le procedure di secret e recovery di riferimento sono descritte in
[gestione segreti](docs/SECRET_MANAGEMENT.md) e
[backup e restore](docs/BACKUP_RESTORE.md).
