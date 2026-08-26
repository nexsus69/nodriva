# Nodriva — checklist di accettazione della verticale canonica

Nodriva è una piattaforma generica per dati operativi connessi. La verticale
*project operations* è il suo percorso di accettazione: dimostra nodi, tipi,
entità, relazioni, allegati, autorizzazione e governance senza introdurre
primitive legate a uno specifico gestionale.

Questa checklist definisce il risultato osservabile. Non autorizza nuove
capability di prodotto: un motore workflow/eventi configurabile resta fuori
perimetro finché un caso Nodriva concreto non ne giustifichi progettazione,
contratti e audit separati.

## Percorso canonico

| Passo | Risultato che l'utente osserva | Evidenza automatica | Evidenza operativa richiesta |
| --- | --- | --- | --- |
| 1. Accesso amministratore | Il superadmin accede e può amministrare il catalogo. | `pnpm check`, E2E admin in `pnpm e2e:parity` | Login su deployment target. |
| 2. Modellazione | Configura o verifica tipi nodo/entità, campi, enum e relazioni. I dati dinamici rispettano lo schema. | E2E canonico e contract test degli adapter. | — |
| 3. Utente operativo | Crea un utente, assegna ruolo e scope. | E2E canonico. | Verifica ACL sul target se il rilascio modifica ruoli o scope. |
| 4. Perimetro | L'operatore vede soltanto il proprio scope; un accesso diretto fuori scope è negato. | E2E canonico, test ACL/parità. | — |
| 5. Lavoro operativo | Crea nodi, progetti, attività e documenti; modifica dati dinamici e allegati senza perdita silenziosa della bozza. | E2E canonico, test form e modifiche non salvate. | Upload/download e scansione solo se gli allegati sono abilitati nel deployment. |
| 6. Concorrenza | Due sessioni esercitano lock, rilascio e rifiuto di `rowVersion` obsoleta. | E2E canonico e test sessione/lock. | Contesa reale fra browser su deployment con realtime, se abilitato. |
| 7. Cestino e audit | Delete/restore conservano scope e audit; i record ripristinati tornano coerenti. | E2E canonico, contract test PostgreSQL/SQLite. | Ispezione audit per una mutation controllata. |
| 8. Parità profili | SQLite standalone e PostgreSQL completo producono gli stessi esiti comuni. | Job CI **Browser parity on SQLite and PostgreSQL** (`pnpm e2e:parity`). | Realtime e antivirus possono essere esclusi solo nel profilo SQLite. |
| 9. Recuperabilità | Schema e dati possono essere recuperati senza toccare il database operativo. | Bootstrap/migrazioni in CI. | Backup con checksum e restore in database usa-e-getta; healthcheck e piano di rollback del target. |

## Gate automatici

Sul commit candidato devono risultare verdi:

- `pnpm check`;
- job CI **PostgreSQL integration and adapter parity**, senza test saltati;
- job CI **Browser parity on SQLite and PostgreSQL**, che esegue
  `pnpm e2e:parity` con Chromium;
- `git diff --check` e working tree privo di modifiche non intenzionali.

Il job browser prepara un database PostgreSQL isolato con ruolo applicativo
ristretto, crea un SQLite temporaneo e non usa dati o credenziali operative.

## Gate del deployment

Prima di dichiarare Nodriva pronta nel target scelto, completare quanto
applicabile in [`RELEASE_CHECKLIST.md`](./RELEASE_CHECKLIST.md): backup/restore,
healthcheck, HTTPS/cookie/WebSocket, segreti gestiti, allegati e antivirus,
osservabilità, alerting e rollback. Questi controlli non sono sostituiti dalla
CI perché dipendono dall'infrastruttura reale.

## Regola di modifica

Ogni modifica che cambia un passaggio della tabella deve aggiornare nella stessa
pull request il test corrispondente e questo documento, se cambia il risultato
utente. Le differenze interne fra SQLite e PostgreSQL sono ammesse solo quando
mantengono l'esito osservabile elencato qui.
