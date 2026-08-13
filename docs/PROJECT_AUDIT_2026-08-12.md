# Audit tecnico — 12 agosto 2026

> **Documento storico.** Risultati, conteggi e rilievi descrivono lo snapshot
> del 12 agosto 2026 e non vengono riscritti retroattivamente. Lo stato corrente
> delle correzioni è mantenuto in
> [`CODE_QUALITY_AUDIT_TRACKER.md`](./CODE_QUALITY_AUDIT_TRACKER.md). Dopo questo
> audit sono stati aggiunti contract test SQLite/PostgreSQL, un E2E comparativo
> del pannello admin, lint Core e il refactoring delle route frontend.

## Esito

Il progetto ha una buona struttura generale: il core espone porte, gli adapter
PostgreSQL sono separati dalla presentazione, le azioni passano in gran parte
dai servizi applicativi e l'uso di query parametrizzate è consistente. La
build, il typecheck, il lint Web e i test attualmente disponibili passano.

L'upgrade di sicurezza eseguito dopo l'audit ha risolto tutte le vulnerabilità
production note al momento della verifica. Restano da qualificare esplicitamente
SQLite come profilo incompleto e da affrontare i problemi di parità e qualità
descritti qui sotto.

## Ambito e metodo

- Inventario dell'intero repository tracciato (572 file applicativi,
  configurativi, test, Docker, SQL e documentazione); controllo della
  struttura, delle dipendenze e delle convenzioni architetturali.
- Analisi statica globale di TypeScript/TSX, API route, server actions,
  configurazione runtime, Docker, migrazioni e adapter PostgreSQL/SQLite.
- Lettura mirata dei percorsi a maggior rischio: autenticazione, ACL, lock,
  realtime, allegati, schema dinamico, transaction boundary e bootstrap.
- Confronto manuale tra i contratti delle porte e le implementazioni PostgreSQL
  e SQLite. I file del core e le API non contengono query SQL nel frontend.
- Verifiche eseguite: `pnpm typecheck`, `pnpm lint`, `pnpm test`, build Web e
  `pnpm audit --prod`.

Questo è un audit del codice presente; i test di integrazione che richiedono
PostgreSQL non sono stati eseguiti perché la suite li salta in assenza del
servizio configurato. Non sono stati eseguiti E2E: richiedono lo stack Docker
e credenziali reali.

## Problemi da correggere

### Risolto — dipendenze vulnerabili

`packages/web/package.json:17` blocca Next.js a `16.2.10`. `pnpm audit --prod`
riporta 15 vulnerabilità transitivamente installate (8 high, 7 moderate):

- Next.js `< 16.2.11`: bypass di middleware/proxy, DoS nelle Server Actions,
  SSRF e disclosure/cache confusion in App Router;
- `sharp < 0.35.0`: quattro CVE high in libvips;
- PostCSS/nanoid: advisory di lettura file, path traversal, XSS e loop.

**Risoluzione applicata.** Next ed `eslint-config-next` sono aggiornati a
`16.3.0`; il lockfile aggiorna `sharp` a `0.35.3` e PostCSS a `8.5.23` nel
runtime Next. Un override workspace fissa `nanoid` a `3.3.17`, versione patch
compatibile richiesta dall'advisory. `pnpm audit --prod` ora restituisce
`No known vulnerabilities found`.

### P1 — il reader degli schemi SQLite perde regole di dominio

`packages/core/src/infrastructure/sqlite/TypeDefinitionReaderSqlite.ts:15-18`
legge solo una parte dei metadati. Ignora `is_active`, posizione, constraints,
enum options e `enum_mode`, e costruisce sempre constraint vuoti ed enum
`static`. Le tabelle SQLite corrispondenti esistono
(`SqliteSchema.ts:231-250`), quindi non è un limite imposto dal modello.

**Impatto.** Nel profilo SQLite la validazione runtime può accettare payload
che PostgreSQL rifiuterebbe (regex/range/enum gestiti) e un tipo disabilitato
può essere ricostruito dal registry. È una violazione della promessa
"adapter-agnostic" e rende i test SQLite un falso indicatore di parità.

**Rimedio.** Caricare constraints e opzioni per ogni field, rispettare
`enum_mode` e tipi/field attivi, mantenere l'ordinamento `position` e aggiungere
test contrattuali identici per PostgreSQL e SQLite, inclusi enum managed,
constraint, tipo disabilitato e cifratura.

### P1 — ACL delegata SQLite non implementa le invarianti documentate

`packages/core/src/infrastructure/sqlite/SecurityRepositorySqlite.ts:21` limita
un amministratore locale alle assegnazioni di cui è già destinatario, invece
del confine gestibile definito in architettura. Alla riga 31
`revokeDelegatedScopeAssignmentsOutsideCoverage()` è un no-op. PostgreSQL
implementa invece coverage, cascade e audit delle revoche.

**Impatto.** In standalone SQLite deleghe non vengono revocate quando il
delegante perde l'autorità; inoltre le funzionalità di amministrazione scoped
sono semanticamente diverse dal deployment PostgreSQL. È un rischio di
autorizzazione se SQLite viene usato oltre una demo mono-admin.

**Rimedio.** Implementare lo stesso algoritmo/contratto nel repository SQLite
o disabilitare in modo esplicito le deleghe scoped nel profilo SQLite. Aggiungere
test di regressione per deny sovrapposti, perdita di copertura e cascata.

### P1 — paginazione subtree SQLite non è scalabile

`packages/core/src/infrastructure/sqlite/EntitySubtreeQueryPortSqlite.ts:8-12`
carica l'intero sottoalbero, lo filtra con una query ACL per ogni entità, lo
ordina in memoria e solo dopo applica `limit`/cursor.

**Impatto.** La pagina nominalmente paginata ha costo O(numero di entità) e
N+1 query ACL; su alberi grandi causa latenze, memoria e facile DoS applicativo.
Il comportamento del cursor dipende inoltre dalla lista completa anziché da una
query deterministica come nell'adapter PostgreSQL.

**Rimedio.** Portare filtro ACL, ricerca, cursor e `LIMIT + 1` in SQL, con gli
indici necessari su path/parent/type e lock attivi; verificare le due direzioni
con dataset numerosi e deny/allow annidati.

### P2 — cancellazione allegati non atomica

In `packages/web/src/app/api/attachments/[attachmentId]/route.ts:59-62` viene
eliminato prima il blob e poi il record DB, senza una transazione/outbox.

**Impatto.** Se la seconda operazione o l'audit fallisce, resta un record che
punta a un file già perso. L'upload gestisce invece correttamente il rollback
best-effort del blob dopo un fallimento DB.

**Rimedio.** Marcare/eliminare il record nel DB in una transazione e fare la
cancellazione fisica post-commit, con retry/outbox per gli errori storage;
includere audit e notifiche nello stesso flusso post-commit. Prevedere un job
di riconciliazione per blob orfani e record senza contenuto.

### P2 — bootstrap SQLite contiene identità demo hard-coded

`packages/core/src/infrastructure/sqlite/SystemSeedSqlite.ts:10` imposta
sempre l'email amministrativa `marco123@test.com`, benché usi una password da
environment. La configurazione Docker consente invece di scegliere
`SEED_ADMIN_EMAIL`.

**Impatto.** Il comportamento del profilo SQLite diverge da quello PostgreSQL,
espone un identificativo demo in un artefatto runtime e non è adatto a un
bootstrap operativo configurabile.

**Rimedio.** Passare email e flag di bootstrap espliciti attraverso il port,
validarli e usare un valore obbligatorio (o generato/mostrato una volta) in
produzione. Evitare `INSERT OR REPLACE` per non sovrascrivere silenziosamente
un account esistente.

### P3 — leggibilità e verificabilità del ramo SQLite

Molti adapter SQLite comprimono un'intera classe in una o poche righe
(`SecurityRepositorySqlite.ts`, `SystemSeedSqlite.ts`,
`SystemConfigRepositorySqlite.ts`, `FieldEncryptionServiceSqlite.ts` e altri).
Usano spesso `any`, catch silenziosi e SQL/controllo di flusso mescolati.

**Impatto.** TypeScript e lint non rilevano con efficacia bug semantici in
questi file; la revisione, il debugging e il diff diventano inutilmente
rischiosi. È la causa strutturale più probabile delle divergenze sopra.

**Rimedio.** Formattare e separare metodi/query/mapping, introdurre interfacce
di row tipizzate, vietare `any` nel core tramite ESLint dedicato e aggiungere
test contrattuali condivisi per ogni porta con doppia implementazione.

## Osservazioni minori

- `packages/web/next.config.ts:9` contiene un IP privato hard-coded in
  `allowedDevOrigins`: spostarlo in configurazione di sviluppo documentata per
  evitare dipendenze dall'ambiente dello sviluppatore.
- La build segnala ripetutamente che `node:sqlite` è sperimentale. Non è un
  errore della build, ma rende necessario fissare una versione Node supportata
  e testare backup, concorrenza e upgrade del database SQLite.
- Gli errori attesi nei test realtime vengono scritti su stderr; non sono
  fallimenti, ma un logger iniettato/silenziato nei test renderebbe i report CI
  più leggibili.
- I test coprono molto bene i servizi puri (402 test eseguiti), ma gli adapter
  SQLite critici hanno copertura scarsa e 11 test PostgreSQL/Web sono saltati.
  La qualità del core è quindi migliore del grado di confidenza end-to-end.

## Cosa è già fatto bene

- La separazione domain/application/infrastructure/presentation è documentata
  e generalmente rispettata; il frontend non accede al database.
- Le route degli allegati verificano sessione, ACL, field metadata, tipo
  rilevato, quota, rate limit e impostano header di download prudenti.
- Le mutation principali passano per servizi applicativi, optimistic locking,
  audit e invalidazione cache/realtime; PostgreSQL usa query parametrizzate e
  funzioni SECURITY DEFINER per il DDL dinamico.
- Docker separa ruolo applicativo e superuser nel profilo completo e la build
  standalone riesce.

## Piano consigliato

1. Aggiornare immediatamente le dipendenze vulnerabili e rendere verde
   `pnpm audit --prod`.
2. Decidere se SQLite è un profilo supportato: se sì, chiudere le tre lacune
   di parità e introdurre una suite di contract test; se no, limitarlo
   esplicitamente a demo/sviluppo nell'avvio e nella documentazione.
3. Correggere il workflow transazionale degli allegati e aggiungere test di
   fallimento storage/DB/audit.
4. Riformattare gradualmente gli adapter SQLite e attivare lint TypeScript
   anche nel package core, con regole contro `any` non giustificato.
5. In CI avviare PostgreSQL e lo stack necessario per eseguire le integrazioni
   oggi saltate; aggiungere E2E responsive ai viewport 320, 375, 768 e desktop.

## Risultati delle verifiche

| Verifica | Risultato |
| --- | --- |
| `git diff --check` | OK |
| `pnpm typecheck` | OK |
| `pnpm lint` | OK, con 4 warning Next su navigazioni interne esistenti |
| `pnpm test` | 402 passati, 11 saltati per integrazioni esterne |
| `pnpm --filter @dashboard/web build` | OK |
| `pnpm audit --prod` | OK: nessuna vulnerabilità nota |

## Modifiche introdotte dall'audit

- Eliminato `PROJECT_CONTEXT_PROMPT.md`, file non tracciato fornito come
  contesto temporaneo, come richiesto.
- Creato questo report. L'upgrade successivo ha modificato solo manifest,
  configurazione workspace e lockfile delle dipendenze; nessun secret è stato
  modificato e non è stato creato alcun commit.
