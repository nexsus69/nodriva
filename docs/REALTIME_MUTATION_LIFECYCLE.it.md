# Ciclo di vita delle mutazioni realtime

Le mutazioni di nodi ed entità persistono dato ed evento relativo nella stessa
transazione PostgreSQL. Dopo il commit, l'action avvia un drain best-effort
dell'outbox; la risposta non dipende dalla disponibilità di Pusher.

Gli eventi viaggiano su canali determinati dalla policy:

```text
private-realtime-policy-{policyHash}-data
```

Il server risolve il nodo padre e tutti gli antenati, applica allow/deny e
pubblica su ogni policy che include la risorsa. In caso di spostamento valuta
anche gli antenati della posizione precedente. Il frontend delega al
coordinatore di invalidazione la decisione di aggiornare il read model,
invalidare una vista o ignorare un evento già superato da `rowVersion`.

## Ordine della mutazione

1. Il servizio applicativo autentica l'attore e verifica scope, lock e
   `rowVersion`.
2. La transazione persiste la mutazione, l'audit richiesto e l'evento outbox.
3. Il commit rende visibili dato e evento insieme.
4. Il worker o il drain post-commit pubblica l'evento sui canali autorizzati.
5. Il coordinatore frontend aggiorna o invalida il read model senza diventare
   fonte autorevole per autorizzazione o concorrenza.

Un errore di consegna dopo il commit non annulla la mutazione: l'outbox resta
disponibile per il retry idempotente. Un errore prima del commit annulla dato,
audit ed evento insieme. SQLite mantiene lo stesso risultato osservabile senza
richiedere realtime o un outbox distribuito quando tali integrazioni non sono
configurate.

## Spostamenti e cancellazioni

Uno spostamento pubblica l'invalidazione per la posizione precedente e per
quella nuova, rispettando entrambe le policy. Una cancellazione o un ripristino
mantengono scope, audit e `rowVersion`; il cestino non concede visibilità
aggiuntiva. Gli eventi duplicati o fuori ordine vengono ignorati quando la
versione osservata è già più recente.

## Vincoli frontend

Polling, heartbeat passivi e ascolto realtime non rinnovano la sessione. La
bozza attiva e il lock devono sopravvivere a riconnessioni e aggiornamenti
falliti; un conflitto mostra un errore semantico e non sovrascrive dati locali.
