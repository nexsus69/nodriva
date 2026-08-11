# Lock amministrativi

Le pagine di dettaglio amministrative usano la stessa primitiva dei nodi e
delle entità: `LockService` persiste il lock in PostgreSQL, pubblica gli
eventi Pusher sui canali autorizzati e applica TTL, heartbeat e proprietà della
sessione.

## Risorse protette

- `user`
- `role`
- `scope_assignment`
- `node_type`
- `entity_type`
- `system_setting`
- `runtime_capability`
- `placement_policy`

Le mutation amministrative acquisiscono il lock dopo il controllo ACL e lo
rilasciano in un blocco `finally`. `rowVersion` resta una seconda barriera:
un form vecchio viene rifiutato anche se il lock è già stato rilasciato.

## Comportamento UI

Le pagine di dettaglio mostrano il proprietario del lock, lo stato della
risorsa e i comandi per acquisire o rilasciare il lock. Un lock posseduto da
un'altra sessione rende l'operazione non disponibile e il backend continua a
rifiutare comunque ogni mutation non autorizzata.

## Verifica minima

1. Aprire lo stesso dettaglio amministrativo in due sessioni.
2. Acquisire il lock nella prima sessione.
3. Verificare nella seconda sessione lo stato bloccato e l'evento realtime.
4. Tentare una mutation dalla seconda sessione: deve risultare `LOCK_CONFLICT`.
5. Rilasciare il lock e ripetere: la mutation deve riuscire solo con una
   `rowVersion` aggiornata.
6. Controllare gli eventi `lock.acquire`, `lock.conflict` e `lock.release` nel
   registro audit.

I test automatici del core coprono ownership, conflitto, audit e routing dei
canali amministrativi; i test browser devono essere eseguiti con sessioni
autenticate non scadute.
