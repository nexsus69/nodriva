# Motore degli eventi workflow

[Italiano](WORKFLOW_EVENT_ENGINE.it.md) | [English](WORKFLOW_EVENT_ENGINE.md)

Il workflow è una capability generica: cataloga eventi, definizioni e azioni
senza conoscere un dominio applicativo specifico. Il motore pianifica azioni
idempotenti a partire da un evento persistito; non interpreta payload nella UI.

## Contratto

Gli eventi hanno tipo, versione, soggetto, attore, idempotency key e payload
validato. Le definizioni selezionano eventi e azioni tramite cataloghi semantici.
Le chiavi tecniche restano stabili; nome e descrizione sono presentati in modo
localizzato. Condizioni, retry, error handling e parametri avanzati vengono
validati dal backend.

La mutation che crea evento, audit e outbox è transazionale. Il worker elabora
solo eventi committati, usa lease e retry con backoff e non esegue due volte la
stessa azione effettiva. Un errore permanente produce stato e audit, non una
perdita silenziosa.

## Sicurezza e test

Autorizzazione, scope, cifratura e validazione restano nel backend. Provider
esterni sono opzionali e dichiarati dal deployment; un endpoint non configurato
non è un fallback implicito. Testare idempotenza, retry, ordine, concorrenza,
revoca, errori provider e parità PostgreSQL/SQLite in ambiente isolato.
