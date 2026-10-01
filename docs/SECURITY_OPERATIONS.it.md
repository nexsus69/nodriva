# Operazioni di sicurezza

Questo runbook è il contratto operativo per le evidenze audit e il recupero
dell'identità amministrativa. Separa deliberatamente le azioni implementate
dall'applicazione da quelle di competenza dell'operatore di deployment.

## Conservazione, export e revisione dell'audit

`audit_logs` è un'evidenza applicativa append-only. I ruoli applicativi ricevono
`audit.access` solo quando devono leggerla; nessuna UI o query port può esporla a
un attore non autorizzato. Le credenziali usate dal Web non devono avere
`DELETE` o `TRUNCATE` su questa tabella.

Conservare online i dati audit per 365 giorni. Il primo giorno lavorativo di
ogni mese un operatore esporta il mese precedente come JSON newline-delimited,
lo deposita nell'archivio immutabile approvato con cifratura e retention lock di
sette anni, verifica il checksum e registra il riferimento nel sistema di
change-management. Solo dopo un archivio verificato è possibile eliminare i
record più vecchi di 365 giorni, in batch limitati, tramite un job di
manutenzione autorizzato separatamente. I backup non sostituiscono questo
export.

Ogni trimestre un super-admin che non ha concesso l'accesso esaminato svolge la
revisione: esporta utenti attivi, ruoli globali, assegnazioni scope (inclusi
allow/deny e propagazione) e super-admin; confronta il risultato con l'elenco
owner approvato, revoca eccezioni e conserva il verbale firmato. La revisione
controlla anche reset password, attivazione/disattivazione utenti, mutazioni di
ruoli e scope ed eventi di rate limit login falliti.

## Credenziali amministrative

Il reset password amministratore esistente è uno strumento di recupero
d'emergenza: richiede un super-admin, invalida tutte le sessioni target e
scrive un record audit. Non va usato come reset self-service né per comunicare
password in chiaro.

Prima di abilitare inviti o reset password pubblico, distribuire insieme:
store di token monouso, hashati e con scadenza; adapter di consegna mail; pagina
pubblica che consuma atomicamente il token; rate limiter condiviso per account e
indirizzo sorgente; ed eventuale enrollment MFA con segreto TOTP cifrato e
codici di recupero. MFA è opzionale solo a livello prodotto: quando abilitato
per un'identità amministrativa è richiesto a ogni nuovo login e il recupero/reset
deve revocare il fattore.

Un rate limiter in-process non è sufficiente perché le repliche Web non
condividono lo stato. Usare un adapter basato su database o Redis ed emettere un
evento audit/sicurezza strutturato per un blocco, senza rivelare se l'indirizzo
email esiste.

La composition Web usa il limiter PostgreSQL condiviso sia per la chiave account
normalizzata sia per l'indirizzo sorgente del proxy fidato. Configurare il proxy
per sostituire, non aggiungere, l'header IP del client. La consegna delle azioni
account è fail-closed: impostare `ACCOUNT_ACTION_DELIVERY_WEBHOOK_URL`,
`ACCOUNT_ACTION_PUBLIC_BASE_URL` e, opzionalmente, il bearer secret.
`ACCOUNT_ACTION_DELIVERY_TIMEOUT_MS` imposta il timeout della richiesta (10
secondi se omesso). L'endpoint HTTPS riceve `to`, `template`, `actionUrl` e
`expiresAt` e deve inviare la mail corrispondente.

## Rate limit dei login e rilascio amministrativo

Il limiter registra cinque tentativi rifiutati in una finestra di quindici minuti
per ogni soggetto account normalizzato e indirizzo sorgente fidato. Il quinto
rifiuto e ogni richiesta successiva mentre uno dei soggetti è bloccato restituisce
al form lo stesso esito sicuro di throttling temporaneo. Il form comunica che i
tentativi sono sospesi e chiede di riprovare tra pochi minuti; non rivela se è
bloccato account, indirizzo o entrambi e non rivela l'esistenza dell'account.

Un login riuscito libera entrambi i soggetti. Un amministratore non deve liberare
un blocco dell'indirizzo solo rilasciando un account, perché una rete condivisa
può essere stata limitata per tentativi contro altre identità. Un super-admin
può liberare il soggetto account dal dettaglio amministrativo dell'utente o
ispezionare e liberare un indirizzo esatto in **Platform → Sicurezza sessione**.
Entrambe le operazioni ricontrollano permesso e autorità super-admin dentro una
transazione di autorizzazione e scrivono l'evidenza audit
`auth.login_rate_limit_released`. Gli indirizzi restano hashati: il pannello
calcola l'hash dell'indirizzo inserito solo per cercare il blocco e non espone
inventari di origini.

TOTP richiede `MFA_ENCRYPTION_KEY`, un segreto deployment base64 di 32 byte. I
segreti di enrollment sono cifrati AES-256-GCM e i codici recupero sono salvati
solo come hash SHA-256. Ruotare questa chiave solo con un nuovo enrollment
pianificato o con una procedura dedicata di ricifratura dati.

Un enrollment sostitutivo resta in colonne pending separate per dieci minuti.
Fattore attivo e codici di recupero restano validi finché un codice corretto non
promuove il segreto pending. Promozione, eliminazione del fattore e consumo dei
codici commit-tano con l'audit richiesto nella stessa transazione; un enrollment
scaduto o consumato concorrente non può sostituire il fattore.

Le claim di consegna delle azioni account usano lease esclusiva e recupero
limitato delle lease stale sia in PostgreSQL sia in SQLite. Un secondo worker
non riceve la stessa claim viva; la claim di un worker terminato diventa
ritentabile dopo cinque minuti.

L'emissione del recupero account verifica autorità super-admin e legge il
destinatario nella transazione che persiste token, audit e intento di consegna.
Una revoca di autorizzazione committata prima deve impedire l'emissione in
entrambi gli adapter. `AccountRecoveryApplicationService` possiede la regola
tramite i port esistenti di access-control e transazione.

L'azione pubblica di completamento usa il mapper errori Web condiviso con
contesto esplicito: token invalido, scaduto o consumato condividono un messaggio
sicuro; password invalida resta un errore di validazione; guasti infrastrutturali
producono un errore interno ritentabile, mai un messaggio di link invalido. Una
transazione fallita lascia il token disponibile per il retry e conserva nel form
la password inserita. I dettagli interni restano lato server.

## Revisione della portabilità

Le feature PostgreSQL-specifiche restano in `infrastructure/postgres` e nelle
migrazioni: operatori gerarchici `ltree` e indici GiST, claim outbox
`FOR UPDATE SKIP LOCKED`, trigger transazionali, JSONB e quoting dinamico degli
identificativi per tabelle per tipo. Domain e Application espongono solo port e
non devono importare adapter PostgreSQL o SQL.

Un adapter sostitutivo deve fornire contenimento gerarchico equivalente,
semantiche transazionali e di lock, gestione sicura degli identificativi (mai
parametri SQL), concorrenza ottimistica e claim outbox atomica. La suite deve
coprire parità ACL allow/deny sui subtree, claim concorrenti, rollback e
identificativi dinamici non validi prima del collegamento nella composition root.

## Gestione delle chiavi di cifratura

`FIELD_ENCRYPTION_KEY` e `ATTACHMENTS_ENCRYPTION_KEY` sono segreti di deployment
forniti da secret manager o KMS; non vanno mai committati in file `.env` o log.
I servizi accettano un keyring `v1=<64 hex chars>,v2=<64 hex chars>` tramite
rispettivamente `FIELD_ENCRYPTION_KEYS` e `ATTACHMENTS_ENCRYPTION_KEYS`. La
versione attiva è scelta da `FIELD_ENCRYPTION_ACTIVE_VERSION` o
`ATTACHMENTS_ENCRYPTION_ACTIVE_VERSION`.

I nuovi valori sono cifrati con la chiave attiva. I valori esistenti conservano
la versione memorizzata e restano decifrabili finché la chiave precedente è
presente. I ciphertext dei campi includono la versione nei metadati database e
gli allegati del nuovo formato la includono nell'envelope autenticato; i valori
legacy `v1` restano leggibili per compatibilità.

Procedura di rotazione:

1. creare una nuova chiave casuale da 32 byte nel secret manager;
2. distribuire insieme chiave vecchia e nuova, rendendo attiva la nuova versione;
3. eseguire e monitorare il job autorizzato `pnpm encryption:rotate`;
4. creare e verificare un backup prima di rimuovere la chiave precedente;
5. rimuovere la vecchia chiave solo dopo la ricifratura di tutti i ciphertext e
   allegati e un restore riuscito con la chiave nuova.

L'applicazione offre decifratura dual-key, cifratura con chiave attiva e job
bulk riprendibile per la ricifratura. Stato durevole ed eventi audit devono
essere verificati prima di ritirare una chiave; la verifica del backup resta
obbligatoria.
