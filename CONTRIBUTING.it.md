# Contribuire a Nodriva

[Italiano](CONTRIBUTING.it.md) | [English](CONTRIBUTING.md)

Grazie per il contributo. Nodriva è una piattaforma generica: le modifiche non
devono trasformarla silenziosamente in un prodotto per un solo dominio.

Docker Compose è un profilo di riferimento/test, non un requisito
dell'applicazione. I contributi devono preservare SQLite standalone e PostgreSQL
gestito dall'operatore e non rendere le integrazioni opzionali dipendenze
implicite.

## Prima di aprire una pull request

1. Leggere [l'architettura](ARCHITECTURE.it.md) e i documenti applicabili in
   `docs/`.
2. Mantenere separati Domain, Application, Infrastructure e Web. Autorizzazione
   backend, lock, validazione e `rowVersion` sono autorevoli; UI e cache no.
3. Preservare il contratto osservabile dei profili PostgreSQL e SQLite per il
   comportamento comune.
4. Aggiungere un test mirato di regressione o dell'invariante per ogni fix
   comportamentale.
5. Non committare credenziali, file `.env`, dump database, payload allegati o
   archivi di backup.

## Verifica locale

Eseguire i controlli pertinenti prima dell'invio:

```bash
pnpm check
pnpm test:postgres:local
pnpm e2e:parity
```

Per i controlli PostgreSQL distruttivi usare solo un database isolato il cui
nome contiene `test`. Consultare README e `docs/` per comandi mirati di test e
deployment.

## Pull request

Mantenere piccola ogni pull request e descrivere intento visibile all'utente,
owner architetturale, test eseguiti, impatto PostgreSQL/SQLite ed eventuali
modifiche operative o documentali. Non unire refactoring estranei a una
modifica comportamentale. La CI deve essere verde prima del merge.
