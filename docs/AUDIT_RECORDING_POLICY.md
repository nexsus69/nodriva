# Policy di registrazione audit

## Principio

I casi d'uso emettono esplicitamente un evento audit semantico, con attore,
azione, risorsa e contesto prima/dopo. Non decidono però in modo autonomo se
l'evento debba essere conservato: tutta la persistenza passa da
`PolicyAuditRecorder`.

La policy applicativa usa un catalogo di azioni. Le azioni non presenti nel
catalogo e quelle classificate come evidenza di governance o sicurezza sono
obbligatorie. Solo le azioni dichiarate configurabili possono essere escluse.
Un errore nella lettura della configurazione conserva l'evento secondo il
default sicuro, quindi non elimina evidenze in modo silenzioso.

## Attività ordinaria dei lock

L'impostazione runtime **Registra attività ordinaria dei lock**
(`audit.recordLockLifecycle`) è attiva per default e controlla esclusivamente:

- `lock.acquire`;
- `lock.release`, incluso il rilascio conseguente alla chiusura della sessione.

Rimangono sempre auditati `lock.conflict` e `lock.force_release`: il primo è
un segnale utile di contesa, il secondo è una mutation amministrativa.
L'impostazione non modifica persistenza, TTL, ownership, `rowVersion`, rilascio
o notifiche realtime dei lock.

## Estensione

Per rendere configurabile un'altra famiglia di eventi si aggiunge una
definizione al catalogo applicativo, un'impostazione runtime descrittiva e i
relativi test. Non sono ammessi `if` di soppressione sparsi nei singoli casi
d'uso o negli adapter di persistenza.
