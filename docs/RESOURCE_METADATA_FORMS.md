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

File e immagini non sono ancora tipi di colonna dinamica: vengono trattati
come allegati collegati alla risorsa. `AttachmentInput` gestisce la selezione
locale e i limiti di quantità, dimensione e MIME type; il contenuto non viene
salvato nel `payload` né in una colonna PostgreSQL.

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
impostare `ATTACHMENTS_REQUIRE_SCAN=true` e collegare un’implementazione di
`AttachmentScannerPort`; senza scanner configurato l’upload viene rifiutato.
Il rate limit integrato è per-processo: con più istanze va sostituito con un
limitatore condiviso.

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
