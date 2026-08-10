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
| `relation` | select | Target e opzioni forniti dal coordinator |
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

## Allegati

La primitiva `ResourceAttachmentReference` conserva i metadati dell’allegato:
risorsa, campo, nome, MIME type, dimensione, chiave di storage, checksum e
autore. Il file dovrà essere caricato in uno storage dedicato e il database
dovrà conservare solo questi metadati. Il provider locale salva i contenuti
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
Il progetto include il profilo Docker opzionale `antivirus`: si avvia con
`docker compose --profile antivirus up -d clamav` e il server web va avviato
con `CLAMAV_HOST=127.0.0.1 CLAMAV_PORT=3310`. Il container non è avviato dallo
stack predefinito e la porta è pubblicata solo sul loopback.
Il rate limit integrato è per-processo: con più istanze va sostituito con un
limitatore condiviso.

La cifratura dei nuovi allegati è controllata dal setting globale
`attachments.encryptionEnabled`. Ogni tipo di nodo può sovrascriverlo con una
policy `inherit`, `enabled` o `disabled`; la policy del nodo si applica anche
alle entità contenute nel nodo. La modifica della policy vale per i nuovi
upload: gli allegati esistenti restano leggibili perché il formato di storage
indica autonomamente se il contenuto è cifrato.

## Cifratura selettiva dei campi

Ogni campo dei tipi nodo/entità può usare `inherit`, `plaintext` o `encrypted`.
`inherit` segue `data.fieldsEncryptionEnabled`; `encrypted` salva il valore
nel ciphertext store `resource_field_ciphertexts` e presenta al repository
solo il valore decifrato. La chiave server-side è `FIELD_ENCRYPTION_KEY` (con
fallback compatibile a `ATTACHMENTS_ENCRYPTION_KEY`) e non viene mai inviata al
client. I campi cifrati non sono ricercabili, filtrabili o indicizzabili; il
frontend li tratta come normali controlli solo dopo la lettura autorizzata.

I download sono autorizzati nuovamente a ogni richiesta; solo immagini raster
validate possono essere visualizzate inline. Gli altri file vengono scaricati
come `application/octet-stream` con `nosniff`, CSP, CORP e cache privata.

## Separazione delle responsabilità

`ResourceFormRenderer` si occupa solo del mapping schema → controllo.
`FormRenderer` rende i controlli comuni e gestisce il submit. Il coordinator
della pagina deve fornire valori iniziali, opzioni per enum/relazioni e la
mutazione; autorizzazioni e validazione restano responsabilità del backend.

Per aggiungere un nuovo tipo occorre aggiornare nello stesso cambiamento:

1. il contratto del backend;
2. il mapping in `ResourceFormRenderer`;
3. il controllo o la variante di `FormRenderer`;
4. i test del mapping e del rendering;
5. questa tabella documentale.
