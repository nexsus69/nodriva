# Formato storage degli allegati

[Italiano](ATTACHMENT_STORAGE_FORMAT.it.md) | [English](ATTACHMENT_STORAGE_FORMAT.md)

Lo storage locale usa envelope espliciti, così il contenuto in chiaro non può
essere confuso con un payload cifrato soltanto perché contiene un magic header.

- `DASHRAW1` identifica il plaintext scritto dall'implementazione corrente.
- `DASHATT2` identifica l'envelope autenticato AES-256-GCM versionato.
- I file senza header riconosciuto sono rifiutati.

Le nuove scritture plaintext includono sempre `DASHRAW1`; i formati non
versionati e l'obsoleto `DASHATT1` non fanno parte del contratto. La rotazione
converte il plaintext esplicito in `DASHATT2` quando è disponibile una chiave.

## Mutazioni e concorrenza

`AttachmentApplicationService` possiede autorizzazione e ciclo di vita. I
comandi includono attore, sessione e `expectedRowVersion`; l'HTTP trasporta la
versione tramite form o `If-Match` e correla la mutation con `X-Mutation-Id`.
Upload e delete riusano ACL, lock e CAS dei servizi nodo/entità. La transazione
ricontrolla policy, persiste metadata, audit e outbox; cleanup e delivery avvengono
dopo il commit. SQLite serializza il confine locale, PostgreSQL usa le proprie
transazioni e lock di policy senza cambiare l'esito osservabile.

## Cleanup

Lo storage blob non è transazionale: `attachment_cleanup_outbox` collega i
metadati alle operazioni sul filesystem. Upload, delete e purge registrano job
durabili; il worker usa lease, retry e backoff. Eliminare un blob già assente è
un'operazione idempotente.
