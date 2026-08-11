# Job di ricifratura

Il job `encryption:rotate` esegue la ricifratura fuori dal ciclo HTTP e lavora
a batch. Processa sia `resource_field_ciphertexts` sia i file presenti nello
storage locale degli allegati.

## Prerequisiti

1. applicare `db/migrations/029_encryption_rotation_jobs.sql`;
2. eseguire un backup verificato;
3. configurare la vecchia e la nuova chiave nel secret manager;
4. impostare la nuova versione come attiva;
5. mantenere disponibile la vecchia chiave durante tutta l’operazione.

Esempio concettuale di configurazione, da fornire al processo tramite secret
manager e mai da committare:

```text
FIELD_ENCRYPTION_KEYS=v1=<old-key>,v2=<new-key>
FIELD_ENCRYPTION_ACTIVE_VERSION=v2
ATTACHMENTS_ENCRYPTION_KEYS=v1=<old-key>,v2=<new-key>
ATTACHMENTS_ENCRYPTION_ACTIVE_VERSION=v2
```

## Esecuzione

```bash
ENCRYPTION_ROTATION_BATCH_SIZE=100 pnpm encryption:rotate
```

Il job crea una riga in `encryption_rotation_jobs`, aggiorna contatori e
registra gli eventi `security.encryption_rotation.*` nell’audit trail. In caso
di errore marca il job come `failed`; può essere rilanciato dopo aver corretto
la causa. Gli elementi già sulla versione attiva vengono saltati, quindi il
rilancio è idempotente e riprende di fatto dal punto raggiunto.

La vecchia chiave non deve essere rimossa quando il job termina: prima occorre
verificare che i contatori siano coerenti, eseguire un restore di backup con la
nuova chiave e completare un controllo di lettura dei dati e degli allegati.
Solo dopo queste verifiche la vecchia chiave può essere revocata.
