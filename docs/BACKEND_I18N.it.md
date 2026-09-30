# Contratto di internazionalizzazione backend

[Italiano](BACKEND_I18N.it.md) | [English](BACKEND_I18N.md)

Il backend supporta inglese (`en`) e italiano (`it`). Domain e Application
restano indipendenti dalla lingua: espongono codici errore stabili e dettagli
strutturati, non testo UI scelto per l'utente.

Ai confini API un messaggio può contenere `messageKey`, `messageParams` e un
fallback sicuro `message`. La lingua è scelta prima dalla preferenza dell'utente,
poi da `Accept-Language`, con inglese come fallback deterministico. I tag sono
normalizzati dal contratto Core condiviso.

I nuovi errori devono introdurre prima codice/chiave e parametri stabili. Le
stringhe italiane esistenti restano fallback di compatibilità durante la
migrazione incrementale.

## Presentazione Web

Il client risolve `messageKey` tramite l'unico resolver
`localizeApiError`; form e schermate non devono renderizzare direttamente
`error.message` quando è disponibile una traduzione. Le mappature contestuali
conservano la propria chiave e non devono essere sostituite dal fallback generico.

Ogni testo rivolto al browser appartiene a `AppLocaleStore.ts` per entrambe le
lingue. `pnpm i18n:guard`, incluso in `pnpm check`, rifiuta nuovi testi hardcoded.
Chiavi tecniche, URL, SQL, contenuti dell'utente e fixture di test sono esclusi
intenzionalmente da questa regola.

I rifiuti di validazione non sono eventi audit: si registrano solo mutation
effettivamente persistite. Telemetria di autorizzazione o abuso, se introdotta,
usa un contratto separato di eventi sicurezza.
