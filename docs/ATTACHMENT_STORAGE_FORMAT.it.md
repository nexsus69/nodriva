# Formato di storage degli allegati

[Italiano](ATTACHMENT_STORAGE_FORMAT.it.md) | [English](ATTACHMENT_STORAGE_FORMAT.md)

Lo storage locale usa envelope espliciti, così il contenuto in chiaro non può
essere confuso con un payload cifrato solo perché inizia con un magic header.

- `DASHRAW1` identifica il plaintext scritto dall'implementazione corrente;
- `DASHATT2` identifica l'envelope autenticato AES-256-GCM versionato;
- i file senza header riconosciuto sono rifiutati come non validi.

Le nuove scritture plaintext includono sempre `DASHRAW1`. Nella fase di
sviluppo corrente non esiste un contratto di compatibilità legacy: file non
versionati e formato obsoleto `DASHATT1` sono rifiutati. La rotazione converte
l'envelope plaintext esplicito in `DASHATT2` quando è disponibile una chiave di
cifratura.

## Contratto di mutazione e concorrenza

`AttachmentApplicationService` possiede autorizzazione e ciclo di vita degli
allegati. I comandi di upload includono utente/sessione autenticati e
`expectedRowVersion`; le request multipart trasportano la versione in un campo
form. Le request DELETE trasportano la versione numerica attesa in `If-Match`.
Sessione o versione mancanti sono rifiutate. `X-Mutation-Id` correla
l'operazione browser con l'evento durevole; gli eventi entità conservano anche
il namespace del tipo per il refresh della cache.

Entrambe le mutazioni usano il servizio di modifica nodo/entità esistente,
incluse ACL, lock posseduto quando il locking è attivo e scrittura condizionata
della versione. Le risposte riuscite includono risorsa autorevole e nuova
versione. I client concatenano le versioni per più file e conservano gli upload
completati quando riprovano un batch parzialmente riuscito. I form di nuove
risorse acquisiscono un lock per la fase allegati e lo rilasciano dopo.

Staging del blob e scansione opzionale precedono la transazione database finale.
La transazione ricontrolla accesso, campo allegato attivo e policy di sicurezza;
una policy di cifratura o scansione cambiata rifiuta l'upload in staging. Prima
di ogni delivery persiste versione/revisione dell'aggregato, metadati allegato,
audit, stato cleanup e, se attivo, outbox realtime. Un errore di enqueue annulla
aggregato e metadati. SQLite omette intenzionalmente realtime quando disattivato,
conservando lo stesso esito della mutazione.

PostgreSQL serializza il conteggio quota/rate con lock advisory e letture
separate, così le request in attesa vedono il commit precedente. Lock condivisi
su tabelle policy/catalogo stabilizzano i controlli finali, anche in assenza di
override; possono ritardare brevemente modifiche amministrative alle policy.
SQLite usa invece il gate della connessione condivisa e `BEGIN IMMEDIATE`, senza
imporre meccanismi PostgreSQL.

## Cleanup durevole degli orfani

Lo storage blob non è transazionale, quindi le modifiche metadata usano
`attachment_cleanup_outbox` come ponte durevole. L'upload registra cleanup
ritardato dello staging prima di scrivere il blob e lo annulla nella transazione
che crea metadati e audit. Delete e purge accodano cleanup immediato nella
transazione che rimuove metadati e registra audit.

Un drain best-effort parte dopo il commit; l'endpoint worker protetto riprova le
righe pendenti con lease e backoff sia in PostgreSQL sia in SQLite. Eliminare un
blob già assente è un cleanup idempotente riuscito.
