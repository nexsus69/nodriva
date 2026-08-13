# Form e metadati delle risorse

Il frontend costruisce i form delle risorse dai metadati dei campi tramite
`ResourceFormRenderer`. Il backend definisce il tipo del campo; il renderer
sceglie il controllo HTML appropriato e mantiene un comportamento comune per
label, obbligatorietà, valori e submit.

## Tipi supportati

| Tipo metadato | Controllo frontend | Note |
|---|---|---|
| `string` | input testuale | Testo breve |
| `text` | input testuale | Testo libero breve |
| `integer` | input numerico | Step intero |
| `number` | input numerico | Valore numerico |
| `decimal` | input numerico | Valore decimale |
| `boolean` | checkbox | Valore vero/falso |
| `date` | input `date` | Data senza orario |
| `datetime` | input `datetime-local` | Data e ora locali |
| `uuid` | input testuale | Il backend valida il formato UUID |
| `json` | textarea | Payload JSON multilinea |
| `array` | textarea | Rappresentazione serializzata dell’array |
| `enum` | select | Opzioni fornite dai metadati |
| `relation` | ricerca + select | Target dichiarato dal metadata; risultati filtrati dal resolver e dagli scope |
| `file` | selettore allegati | Documenti collegati al campo; storage separato |
| `image` | selettore immagini | Immagini collegate al campo; storage separato |

File e immagini sono tipi di campo metadata, ma non tipi di colonna dinamica:
il backend li registra nel tipo e salva i contenuti in `resource_attachments`.
`AttachmentInput` viene mostrato solo quando il tipo della risorsa dichiara
quel campo; il contenuto non viene salvato nel `payload` né in una colonna
PostgreSQL. L’API rifiuta upload/lista se il campo non esiste o se il tipo
richiesto (`file`/`image`) non corrisponde al metadata.

`timestamp` è accettato come alias compatibile per `datetime` nei dati già
presenti nel sistema.

## Relazioni tra risorse

Un campo `relation` dichiara esplicitamente il dominio (`node` oppure
`entity`) e il `typeKey` del tipo target. Il frontend usa il resolver comune
per cercare risorse in tutti i nodi leggibili, mostrando anche il percorso del
nodo; non limita più la scelta ai fratelli della risorsa corrente. Il backend
verifica nuovamente che il target esista, appartenga al tipo dichiarato e sia
leggibile dall’utente, sia in creazione sia in modifica. Un riferimento non
autorizzato viene quindi rifiutato anche se inviato direttamente all’API.

La relazione conserva solo l’identificativo della risorsa. Il valore mostrato
nel dettaglio viene risolto con lo stesso controllo ACL e può collegare alla
pagina dell’entità target anche quando questa appartiene a un altro nodo.

## Allegati

La primitiva `ResourceAttachmentReference` conserva i metadati dell’allegato:
risorsa, campo, nome, MIME type, dimensione, chiave di storage, checksum e
autore. Il file viene caricato in uno storage dedicato e il database conserva
solo questi metadati. Il provider locale salva i contenuti
fuori dal database e applica un checksum SHA-256. In produzione va impostato
`ATTACHMENTS_ENCRYPTION_KEY` con una chiave AES-256 casuale in formato
esadecimale; `ATTACHMENTS_REQUIRE_ENCRYPTION=true` fa fallire l’avvio se la
chiave manca. La chiave non va committata nel repository.

L’upload verifica estensione, MIME dichiarato e magic bytes, rifiuta SVG/HTML
e altri contenuti eseguibili, applica limiti per file, risorsa e utente, e non
include mai il contenuto nell’audit. Per una modalità antivirus obbligatoria
attivare il setting runtime `attachments.antivirusEnabled` e collegare
un’implementazione di `AttachmentScannerPort`; senza scanner configurato
l’upload viene rifiutato. `ATTACHMENTS_REQUIRE_SCAN=true` resta disponibile
come override di deployment fail-closed.
Nel Compose completo attuale ClamAV è incluso nello stack e il Web lo raggiunge
tramite il DNS interno del servizio. La separazione in un profilo Docker
opzionale non è ancora implementata. In un deployment distribuito il provider
antivirus dovrà invece essere configurabile con host, porta, schema, timeout,
credenziali/riferimenti ai secret e comportamento fail-closed; il server Web
potrà quindi usare un ClamAV remoto o un altro adapter senza dipendere da
Docker locale.
Il rate limit degli upload usa `AttachmentRateLimitPort`: PostgreSQL conserva
gli eventi in `attachment_upload_events`, mentre SQLite usa il proprio store
locale. Più repliche Web che condividono PostgreSQL condividono quindi anche la
finestra; istanze SQLite distinte restano intenzionalmente isolate.

La cifratura dei nuovi allegati è controllata dal setting globale
`attachments.encryptionEnabled`. Il caricamento dei file resta sempre
disponibile: quando il setting è `false`, ogni nuovo allegato viene salvato in
chiaro anche se il tipo di nodo ha una policy `enabled`. Quando il setting è
`true`, il comportamento predefinito resta in chiaro e la policy `enabled` del
tipo di nodo abilita la cifratura; `disabled` la forza in chiaro. La policy del
nodo si applica anche alle entità contenute nel nodo. La modifica della policy
vale per i nuovi upload: gli allegati esistenti restano leggibili perché il
formato di storage indica autonomamente se il contenuto è cifrato.

## Cifratura selettiva dei campi

Ogni campo dei tipi nodo/entità può usare `plaintext` o `encrypted`.
`plaintext` è il valore predefinito; `encrypted`
salva il valore nel ciphertext store `resource_field_ciphertexts` solo quando
`data.fieldsEncryptionEnabled` è `true`, e presenta al repository
solo il valore decifrato. La chiave server-side è `FIELD_ENCRYPTION_KEY` (con
fallback compatibile a `ATTACHMENTS_ENCRYPTION_KEY`) e non viene mai inviata al
client. Per la rotazione sono disponibili `FIELD_ENCRYPTION_KEYS` e
`FIELD_ENCRYPTION_ACTIVE_VERSION`: le nuove cifrature usano la versione attiva,
mentre le versioni precedenti restano leggibili durante la transizione. I campi cifrati non sono ricercabili, filtrabili o indicizzabili; il
frontend li tratta come normali controlli solo dopo la lettura autorizzata.

I download sono autorizzati nuovamente a ogni richiesta; solo immagini raster
validate possono essere visualizzate inline. Gli altri file vengono scaricati
come `application/octet-stream` con `nosniff`, CSP, CORP e cache privata.

## Separazione delle responsabilità

`ResourceFormRenderer` si occupa solo del mapping schema → controllo.
`FormRenderer` rende i controlli comuni e gestisce il submit. Il coordinator
della pagina deve fornire valori iniziali, opzioni per enum/relazioni e la
mutazione; autorizzazioni e validazione restano responsabilità del backend.
`dynamicResourceForm` centralizza inoltre inizializzazione e coercizione del
payload, riconoscimento dei campi allegato, validazione e upload post-creazione
per evitare divergenze fra form nodo ed entità.

Per aggiungere un nuovo tipo occorre aggiornare nello stesso cambiamento:

1. il contratto del backend;
2. il mapping in `ResourceFormRenderer`;
3. il controllo o la variante di `FormRenderer`;
4. i test del mapping e del rendering;
5. questa tabella documentale.
