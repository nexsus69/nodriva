# Contratto di internazionalizzazione backend

[Italiano](BACKEND_I18N.it.md) | [English](BACKEND_I18N.md)

Il backend supporta inglese (`en`) e italiano (`it`). Domain e Application
restano indipendenti dalla lingua: espongono codici errore stabili e dettagli
strutturati, mai testo UI scelto per un utente.

Ai confini API un messaggio può contenere:

- `messageKey`: chiave stabile del catalogo;
- `messageParams`: valori primitivi per l'interpolazione;
- `message`: fallback sicuro per client che non usano ancora il catalogo.

La lingua viene negoziata prima dalla preferenza esplicita dell'utente, poi
dall'header `Accept-Language`, con inglese come fallback deterministico. I tag
sono normalizzati tramite il contratto Core condiviso in
`application/i18n/Locale.ts`.

Un nuovo errore deve aggiungere codice/chiave e parametri stabili prima del
testo tradotto. Le stringhe italiane esistenti restano fallback di
compatibilità mentre il mapper del boundary viene migrato al catalogo in modo
incrementale.

## Presentazione Web

Il client risolve `ApiErrorResponse.messageKey` (o il fallback del codice errore
stabile) tramite l'unico resolver `localizeApiError` in
`packages/web/src/app/errors/localizeApiError.ts`. Form e schermate Admin non
devono renderizzare direttamente `error.message` quando è disponibile un
resolver localizzato; i codici storici sconosciuti possono usare il fallback
sicuro restituito dal server.

Le mappature contestuali conservano la propria `messageKey`: il completamento
dell'account deve descrivere un link non valido, non una sessione scaduta,
anche quando il codice di autorizzazione stabile è condiviso. Il mapper del
boundary non deve sovrascrivere la chiave contestuale con il fallback generico.

Ogni nuovo testo rivolto al browser, incluse etichette, placeholder, stati
vuoto e caricamento, conferme, tooltip e nomi accessibili, appartiene a
`packages/web/src/app/i18n/AppLocaleStore.ts` per ogni lingua supportata. Il
comando `pnpm i18n:guard`, incluso in `pnpm check`, rifiuta nuovi testi
hardcoded fuori dal catalogo. Chiavi tecniche, URL, SQL, contenuti scritti
dall'utente e fixture di test sono esclusi intenzionalmente da questa regola.

I rifiuti di validazione non sono eventi audit: si registrano solo mutazioni
effettivamente persistite nel flusso audit. Eventuale telemetria di
autorizzazione o abuso deve usare un contratto separato di eventi di sicurezza.
