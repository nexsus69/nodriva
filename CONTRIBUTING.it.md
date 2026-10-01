# Contribuire a Nodriva

[Italiano](CONTRIBUTING.it.md) | [English](CONTRIBUTING.md)

Nodriva è una piattaforma generica: una modifica non deve trasformarla
silenziosamente in un prodotto per un solo dominio.

Prima di una pull request:

1. leggere [l'architettura](ARCHITECTURE.it.md) e i documenti applicabili;
2. mantenere separati Domain, Application, Infrastructure e Web;
3. preservare il contratto osservabile comune PostgreSQL/SQLite;
4. aggiungere un test di regressione o dell'invariante per ogni correzione;
5. non committare credenziali, `.env`, dump, allegati o backup.

Eseguire i controlli pertinenti:

```bash
pnpm check
pnpm test:postgres:local
pnpm e2e:parity
```

Usare per i test distruttivi soltanto database isolati con nome contenente
`test`. La pull request deve descrivere intento, owner architetturale, test,
impatto sui due adapter e modifiche operative/documentali. CI verde e worktree
coerente sono necessari prima del merge.
