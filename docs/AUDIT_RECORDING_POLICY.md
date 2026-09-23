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

## Mutation batch delle relazioni

Una conferma nel pannello delle relazioni puo' modificare piu' record sorgente
dello stesso tipo. E' una sola mutation atomica: lock, `rowVersion`, scritture
e audit entrano nella medesima transazione. Per mantenere la tracciabilita'
del singolo record, viene pero' registrato un evento `relationship.link` o
`relationship.unlink` per ogni risorsa effettivamente cambiata, con il suo
snapshot prima/dopo.

Di conseguenza piu' righe con stesso attore e stesso timestamp, anche fino al
millisecondo, possono rappresentare una sola conferma batch e non azioni
indipendenti. L'ordinamento totale `timestamp, id` resta la fonte autorevole
per distinguere le evidenze senza instabilita' di pagina.

## Attività ordinaria dei lock

L'impostazione runtime **Registra attività ordinaria dei lock**
(`audit.recordLockLifecycle`) è attiva per default e controlla esclusivamente:

- `lock.acquire`;
- `lock.release`, incluso il rilascio conseguente alla chiusura della sessione.

Rimangono sempre auditati `lock.conflict` e `lock.force_release`: il primo è
un segnale utile di contesa, il secondo è una mutation amministrativa.
L'impostazione non modifica persistenza, TTL, ownership, `rowVersion`, rilascio
o notifiche realtime dei lock.

## Invalidazione realtime dell'Audit Log

Ogni evento audit che supera la policy e viene effettivamente persistito genera
nella stessa transazione un'invalidazione generica della collection `audit`
nell'outbox realtime. I producer (lock, workflow, allegati e mutation delle
risorse) non pubblicano invalidazioni audit proprie: registrano soltanto
l'evento semantico tramite `PolicyAuditRecorder`.

Se la policy sopprime l'evento, non vengono scritti né il record audit né
l'evento outbox. Se la capability realtime è disabilitata, l'audit conserva il
medesimo risultato persistente ma non viene accodata una notifica che il
profilo non può consegnare. Nel profilo completo il worker pubblica l'evento
solo dopo il commit; la UI coalesca le invalidazioni della collection visibile.

Per risorse amministrative note, lo stesso invalidatore aggiunge anche il
segnale della collection semantica (`user`, `role`, `scope`, tipi o `system`).
Record audit e tutti i segnali autorevoli entrano quindi nella medesima
transazione della mutation. Le pubblicazioni legacy post-commit restano soltanto
un acceleratore compatibile e un loro guasto non trasforma una mutation già
committata in un errore applicativo.

Le query audit applicano sempre l'ordine totale decrescente
`timestamp, id`; elementi con lo stesso timestamp non cambiano pagina in modo
non deterministico.

## Estensione

Per rendere configurabile un'altra famiglia di eventi si aggiunge una
definizione al catalogo applicativo, un'impostazione runtime descrittiva e i
relativi test. Non sono ammessi `if` di soppressione sparsi nei singoli casi
d'uso o negli adapter di persistenza.
