# Architettura dell'informazione amministrativa

## Scopo

Questo documento definisce la navigazione canonica del workspace amministrativo
Nodriva. È un contratto di presentazione Web: non modifica autorizzazione
backend né ownership tecnica delle impostazioni persistite. Application e
Domain restano autorevoli per ogni permesso e validazione.

## Moduli canonici

Il workspace è organizzato secondo l'intento dell'amministratore:

| Area | Moduli | Famiglia di route |
| --- | --- | --- |
| Modello | Tipi, policy di posizionamento, protezione campi | `/admin/model/*` |
| Contenuti | Nodi, entità, protezione allegati | `/admin/content/*` |
| Accesso | Utenti, ruoli, scope | `/admin/access/*` |
| Automazione | Workflow | `/admin/automation/*` |
| Governance | Audit, impostazioni audit, cestino | `/admin/governance/*` |
| Impostazioni | Runtime, integrazioni, sicurezza sessione | `/admin/platform/*` |

Il registry in `packages/web/src/adminPanel/AdminModuleRegistry.ts` è la
definizione eseguibile unica dell'albero. Navigazione sidebar, link overview,
stato modulo e risorse collection usano le sue chiavi e route; una schermata
non deve inventare una seconda gerarchia.

Ogni modulo navigabile dichiara un'icona dal vocabolario `AdminIcon` condiviso.
L'icona comunica lo scopo nella rail e nell'header; l'etichetta localizzata
resta autorevole e va mostrata insieme all'icona quando lo spazio lo consente.
Un'icona mancante o sconosciuta è un errore del registry, non un motivo per
usare silenziosamente il simbolo dashboard generico.

L'accento visivo Admin è configurato una sola volta in
`packages/web/src/app/globals.css` tramite token `--admin-accent-*` su
`.admin-page`. Navigazione, pulsanti, focus ring, paginazione, toolbar e card
devono usare questo contratto condiviso; un componente non può introdurre una
palette viola/blu locale.

## Dettagli amministrativi delle risorse

Le collection `Content → Nodes` e `Content → Entities` aprono dettagli figli
nelle route `/admin/content/nodes/:nodeId` e
`/admin/content/entities/:parentNodeId/:entityId`. Sono superfici di
consultazione e intervento, non moduli autonomi della sidebar: mantengono
contesto, ritorno e azioni dentro `Admin → Content`.

Il dettaglio usa la stessa lettura autorizzata, lo stesso controller di
lock/bozza e gli stessi comandi applicativi del workspace operativo. Admin non
introduce un secondo controllo ACL, lock, `rowVersion`, deletion policy,
allegati o audit. `NodeApplicationService`, `EntityApplicationService` e i
relativi confini transazionali restano owner delle policy; il controller Admin
possiede solo composizione, navigazione e stato di presentazione.

Un amministratore vede una risorsa solo se la normale lettura node-bound o
entity-bound la autorizza nel proprio scope. La route non trasforma
`system.config.read`, ruolo Admin o presenza nella lista in un permesso
aggiuntivo. Un diniego usa la stessa semantica di accesso negato della
superficie operativa e non rivela dati o esistenza fuori scope.

La schermata mostra identità, tipo, path o contenitore, `rowVersion`, lock,
campi dinamici, relazioni e allegati. Le modifiche acquisiscono prima il lock e
mantengono bozza, conflitto di versione e invalidazione realtime tramite il
lifecycle condiviso. Una cancellazione riuscita torna alla collection Admin
corrispondente, non al workspace operativo.

Le collection espongono l'azione `Apri dettaglio amministrativo`; il link al
workspace operativo resta secondario ed esplicito. I test per nodi ed entità
devono coprire mapping riga→route, lettura in scope, diniego fuori scope,
modifica con lock e `rowVersion`, ritorno dopo cancellazione, invalidazione
realtime e parità SQLite/PostgreSQL.

Le azioni di aggiornamento usano sempre `AdminRefreshButton`, che centralizza
icona, etichetta, callback, accessibilità e dimensionamento. Mostra l'etichetta
localizzata insieme all'icona e mantiene larghezza compatta uniforme nelle
toolbar; le schermate non devono ricreare varianti locali.

Date e identificativi tecnici usano i formatter condivisi in
`packages/web/src/adminPanel/adminFormatters.ts`. Le date ISO persistite passano
alla lingua attiva con anno a quattro cifre; identificativi lunghi sono
abbreviati solo visivamente, mantenendo il valore completo copiabile dal
dettaglio audit. Un UUID non è l'unica descrizione quando esiste
`resourceLabel`: l'etichetta precede l'identificativo, con fallback tecnico
esplicito per audit storici e risorse senza etichetta. La composition root usa
`DescriptiveAuditPort`; i componenti Web non implementano mapping per singolo
tipo di risorsa.

## Ownership delle impostazioni e capability opzionali

Le impostazioni di sistema sono tecnicamente generiche ma vengono mostrate
dove appartiene il loro scopo operativo:

| Chiave | Modulo amministrativo |
| --- | --- |
| `data.fieldsEncryptionEnabled` | Modello → Protezione campi |
| `attachments.antivirusEnabled`, `attachments.encryptionEnabled` | Contenuti → Protezione allegati |
| `audit.recordLockLifecycle` | Governance → Registrazione audit |
| `session.idleTimeoutSeconds` | Platform → Sicurezza sessione |

`Impostazioni → Altre impostazioni` è un fallback esplicito per chiavi
introdotte da deployment o versioni successive prima dell'assegnazione
semantica. Mostra solo chiavi non classificate e non crea una seconda area
generica. Capability opzionali mancanti, disabilitate o non supportate mostrano
lo stato runtime normale (o uno stato vuoto autorizzato), mai un errore client.

`Platform → Integrazioni` (`/admin/platform/integrations`) raggruppa realtime,
scansione allegati, consegna account e osservabilità. Mostra provider
sanitizzato, disponibilità, fallback, dipendenze e lifecycle; può richiedere un
healthcheck non mutante. Topologia, endpoint, porte, riferimenti e valori secret
non sono renderizzati né modificabili.

`Platform → Dati e recovery` (`/admin/platform/data-recovery`) raggruppa
database, storage allegati, backup e materiale chiavi necessario al recovery.
Espone solo evidenza sanitizzata dell'ultimo backup verificato: provider, data,
checksum, dimensione, versione schema, verifica restore e dipendenze. Se il
manifest non è leggibile mostra `non disponibile`; non avvia backup né restore.

`Platform → Health e osservabilità` (`/admin/platform/health`) presenta il
catalogo completo dell'intento health. `disabled` è distinto da `non
disponibile`; il refresh invoca solo probe autorizzati non mutanti.

`Platform → Backup` possiede `backup.scheduledEnabled`: sospende solo il job
automatico di deployment, con audit e stato esplicito. Non controlla container,
scheduler del sistema operativo o restore operativo.

## Rottura controllata delle route

I precedenti percorsi piatti e tecnici (`/admin/types`, `/admin/users`,
`/admin/security/*`, `/admin/system/*`, `/admin/audit` e
`/admin/recycle-bin`) sono ritirati. Non esistono redirect, alias o migrazione
dello stato workspace. L'accesso mostra la schermata esplicita di modulo non
disponibile e richiede la navigazione verso una route canonica.

## Regola per nuovi moduli

Prima di aggiungere un modulo definire nel registry area semantica, route
canonica, etichetta e descrizione localizzate, permessi backend e condizioni di
capability. Una nuova impostazione deve avere un solo owner semantico; fino ad
allora è visibile solo nel fallback Platform esplicito. Il modulo usa i
contratti condivisi di risorse, collection, form e stato workspace, incluse le
dipendenze realtime.

La modifica Web include etichette inglesi e italiane localizzate, copertura
autorizzativa, stato vuoto/non disponibile per capability disabilitata e un
aggiornamento E2E Admin quando la route è visibile all'utente.
