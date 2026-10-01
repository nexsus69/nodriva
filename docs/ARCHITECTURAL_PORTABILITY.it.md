# Portabilità architetturale

[Italiano](ARCHITECTURAL_PORTABILITY.it.md) | [English](ARCHITECTURAL_PORTABILITY.md)

La portabilità è definita dal risultato osservabile dei port applicativi, non
dall'uguaglianza dell'implementazione SQL. PostgreSQL è il profilo completo;
SQLite è lo standalone locale. Entrambi devono produrre gli stessi esiti per
autorizzazione, validazione, ordinamento, errori, `rowVersion`, rollback,
transazioni, audit, lock e visibilità.

## Differenze ammesse

PostgreSQL può usare `ltree`, tabelle dinamiche fisiche, advisory lock e outbox
con worker. SQLite può usare closure table, JSON, gate della connessione e
disabilitare realtime o antivirus non configurati. Queste differenze restano
negli adapter e non possono cambiare il contratto applicativo.

## Verifica

Ogni modifica comune aggiorna entrambi gli adapter o documenta perché uno non è
coinvolto. I contract test condivisi verificano round-trip, ACL, scope, lock,
concorrenza, cancellazione/ripristino, allegati, quote, rate limit e rollback.
La suite PostgreSQL usa esclusivamente un database isolato con nome contenente
`test`; la sola suite SQLite non dimostra la parità.

Un adapter non può inventare attore, sessione, versione attesa, scope o policy
mancanti. SQL, DDL e dettagli del database restano nell'Infrastructure; Domain e
Application non importano driver o framework.
