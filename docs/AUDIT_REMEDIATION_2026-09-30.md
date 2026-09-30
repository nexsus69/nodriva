# Correzioni dell’analisi del 30 settembre 2026

Questo documento integra, senza riscriverla, l’analisi storica conservata in
`/home/marco/analisi-nodriva-2026-09-30.md`. Descrive le modifiche locali;
non costituisce una certificazione di sicurezza o un’autorizzazione al deploy.
Verifiche conclusive completate il 1 ottobre 2026 (Europe/Rome).

## Rilievi e correzioni

| Rilievo | Correzione e owner | Regressioni |
| --- | --- | --- |
| Interferenza SQLite fra transazione e accessi indipendenti | `SqliteDatabase` governa tutti gli adapter asincroni tramite un’unica coda rientrante; `TransactionPortSqlite` usa `BEGIN IMMEDIATE` e rilascia la connessione prima degli effetti post-commit | Letture non confermate, scritture indipendenti sopravvissute al rollback, transazioni annidate e after-commit |
| Quota PostgreSQL concorrente | Advisory lock acquisito prima dell’istruzione che legge quota e inserisce; stesso protocollo per il rate limiter | Due upload da 6 byte con limite 10: uno solo accettato; otto richieste con limite 2: due sole accettate, su entrambi gli adapter |
| Allegati senza sessione/versione/lock | `AttachmentApplicationService` riusa i servizi node/entity come owner delle regole di modifica; comandi completi e risposte con nuova versione | Sessione diversa, versione obsoleta, campo/policy/ACL cambiati, rollback e conservazione della bozza |
| Policy valutata troppo presto | Rivalutazione nella transazione finale, letture di configurazione fresche e lock sugli oggetti di policy | Cambio cifratura fra staging e commit; cache non aggiornata con letture transazionali temporanee |
| Outbox allegati dopo commit | Accodamento durevole nella stessa transazione di aggregato, metadati e audit; consegna best-effort successiva | Fallimento dell’accodamento annulla versione e metadati su SQLite/PostgreSQL; eventi con sessione, mutation ID, versione e namespace entità |
| Verticale e CI incomplete | Upload/download/eliminazione e concorrenza allegati nello scenario canonico; albero, schema dinamico e bozze inclusi in `e2e:parity` | Guardrail sul comando CI, E2E sui due profili e realtime |
| Permessi amministrativi errati | Proiezione con `node.edit` e `entity.edit` | Test della proiezione dei permessi |
| Guardrail route difforme | Limite effettivo di 60 righe; presentazione accesso negato estratta dalla pagina nodo | Test architetturale delle route |
| Crypto in Domain | `PasswordHasherPort` applicativo e implementazione in Infrastructure, iniettata dalla composition root | Compatibilità hash, servizi account e guardrail Domain |
| Bootstrap SQLite ambiguo | Bootstrap implicito solo con email e password; errori effettivi non inghiottiti; percorso sincrono di startup separato da quello asincrono protetto | Bootstrap incompleto, idempotenza e catalogo condiviso |

## Problemi emersi durante la verifica browser

- Il mapper degli errori di recupero account sovrascriveva la chiave contestuale
  con quella della sessione scaduta. Ora conserva la chiave corretta; il form
  mostra anche la conferma persistente del completamento. Restano distinti
  link rifiutato, password invalida e guasto infrastrutturale con retry.
- Il rilascio esplicito di un lock poteva essere saltato durante una temporanea
  incoerenza della cache. Il comando viene ora sempre inviato al backend, che
  verifica la sessione proprietaria. Test unitario e scenario allegati realtime
  proteggono questa regressione; nessuna variazione a TTL o policy di sessione.
- Alcuni E2E verificavano messaggi tecnici o testi precedenti alla localizzazione.
  Sono stati allineati ai messaggi e ruoli accessibili correnti, mantenendo le
  verifiche su persistenza, websocket, rollback e conservazione dei valori.

## Verifiche

- `pnpm check`: superato, inclusi documentazione sorgenti, i18n, typecheck,
  lint, 943 test superati e build Web production. I 44 skip della suite generale
  sono test condizionati dall’ambiente, non prove di parità.
- Suite PostgreSQL dedicata: 47 test superati, senza skip, con ruolo applicativo
  ristretto; comprende bootstrap vuoto, upgrade e riapplicazione migrazioni.
- Test backup/restore SQLite e contratto profili Compose: superati.
- Backup/restore PostgreSQL: superato in database temporaneo; verificati schema
  e dati delle fixture, non un archivio operativo con allegati e chiavi.
- `pnpm e2e:full`: 10 test browser superati, inclusi la verticale canonica
  SQLite/PostgreSQL, allegati, seconda sessione, realtime, recupero account,
  schema dinamico, selezione albero e form non salvati.
- `pnpm e2e:parity` senza realtime: 9 test browser superati, inclusa la verticale
  canonica sui due adapter. Nessuno skip nelle due esecuzioni browser.
- `git diff --check`: superato. Container, database e volumi delle prove isolati
  sono stati rimossi; i log e il backup delle sole fixture restano in `/tmp`.

## Invarianti e differenze fra adapter

Autorizzazione, lock e versione restano server-side. La mutazione finale degli
allegati comprende audit, revisione, metadati, stato cleanup e outbox abilitata;
non sono introdotte regole parallele nei componenti o nei repository.
Il filesystem non è transazionale: lo staging durevole e il worker di cleanup
gestiscono i blob senza metadati, anche quando la pulizia immediata fallisce.

SQLite serializza gli accessi alla connessione e usa JSON/closure table come
prima. PostgreSQL usa lock nativi e tabelle esistenti; i lock condivisi sulle
policy possono ritardare brevemente modifiche amministrative concorrenti.
Realtime e antivirus possono restare disabilitati nel profilo standalone.
Nessuna migrazione del formato degli allegati o degli hash password.

## Limiti operativi

Nessun commit, push, deploy o modifica al database operativo. Le prove usano
database dedicati contenenti `test`, SQLite temporanei e un broker realtime
isolato. Il client `psql` del container è usato tramite un wrapper temporaneo
perché non è installato sull’host. Il template browser è inizializzato da zero,
separatamente dalle fixture delle integrazioni.

Il test di recovery del deployment completo, coordinato con allegati e keyring,
resta una verifica operativa dell’ambiente di destinazione. Non è stato eseguito
un antivirus reale né un penetration test. Le modifiche non dichiarano pronta
una release candidata dell’intero deployment.

## File interessati

L’elenco seguente include codice, test e contratti normativi modificati; i due
file `domain/policies/PasswordHasher*` sono spostati in `infrastructure/crypto`.

- `ARCHITECTURE.md`
- `docs/ARCHITECTURAL_GOVERNANCE.md`
- `docs/ATTACHMENT_STORAGE_FORMAT.md`
- `docs/AUDIT_REMEDIATION_2026-09-30.md`
- `docs/BACKEND_I18N.md`
- `docs/HUMAN_ACTIVITY_SESSION_LOCKS.md`
- `e2e/account-recovery-parity.spec.ts`
- `e2e/canonical-vertical-parity.spec.ts`
- `e2e/dynamic-entity-schema.spec.ts`
- `e2e/realtime-vertical.spec.ts`
- `package.json`
- `packages/core/src/application/ArchitectureLayerCompliance.test.ts`
- `packages/core/src/application/ports/AttachmentRepository.ts`
- `packages/core/src/application/ports/PasswordHasherPort.ts`
- `packages/core/src/application/services/AccountRecoveryApplicationService.test.ts`
- `packages/core/src/application/services/AccountRecoveryApplicationService.ts`
- `packages/core/src/application/services/AttachmentApplicationService.test.ts`
- `packages/core/src/application/services/AttachmentApplicationService.ts`
- `packages/core/src/application/services/AuthApplicationService.test.ts`
- `packages/core/src/application/services/AuthApplicationService.ts`
- `packages/core/src/application/services/ConfigService.test.ts`
- `packages/core/src/application/services/ConfigService.ts`
- `packages/core/src/application/services/CurrentAccountApplicationService.test.ts`
- `packages/core/src/application/services/CurrentAccountApplicationService.ts`
- `packages/core/src/application/services/ScopedUserProvisioningService.test.ts`
- `packages/core/src/application/services/ScopedUserProvisioningService.ts`
- `packages/core/src/application/services/UserAdminApplicationService.test.ts`
- `packages/core/src/application/services/UserAdminApplicationService.ts`
- `packages/core/src/domain/policies/PasswordHasher.test.ts`
- `packages/core/src/domain/policies/PasswordHasher.ts`
- `packages/core/src/index.ts`
- `packages/core/src/infrastructure/AccountRecoveryAdapter.contract.test.ts`
- `packages/core/src/infrastructure/PersistenceAdapterParityPostgres.test.ts`
- `packages/core/src/infrastructure/crypto/PasswordHasher.test.ts`
- `packages/core/src/infrastructure/crypto/PasswordHasher.ts`
- `packages/core/src/infrastructure/postgres/AttachmentRateLimitPortPostgres.ts`
- `packages/core/src/infrastructure/postgres/AttachmentRepositoryPostgres.ts`
- `packages/core/src/infrastructure/postgres/LockRepositoryPostgres.ts`
- `packages/core/src/infrastructure/postgres/SystemSeedPostgres.ts`
- `packages/core/src/infrastructure/sqlite/AccessControlPortSqlite.ts`
- `packages/core/src/infrastructure/sqlite/AccountActionDeliveryOutboxSqlite.ts`
- `packages/core/src/infrastructure/sqlite/AccountActionTokenPortSqlite.ts`
- `packages/core/src/infrastructure/sqlite/AdminContentCatalogQueryPortSqlite.test.ts`
- `packages/core/src/infrastructure/sqlite/AdminContentCatalogQueryPortSqlite.ts`
- `packages/core/src/infrastructure/sqlite/AttachmentCleanupPortSqlite.ts`
- `packages/core/src/infrastructure/sqlite/AttachmentPolicyRepositorySqlite.ts`
- `packages/core/src/infrastructure/sqlite/AttachmentRateLimitPortSqlite.ts`
- `packages/core/src/infrastructure/sqlite/AttachmentRepositorySqlite.ts`
- `packages/core/src/infrastructure/sqlite/AuditPortSqlite.ts`
- `packages/core/src/infrastructure/sqlite/AuditQueryPortSqlite.ts`
- `packages/core/src/infrastructure/sqlite/ConfigurationRepositorySqlite.ts`
- `packages/core/src/infrastructure/sqlite/EntityRepositorySqlite.ts`
- `packages/core/src/infrastructure/sqlite/EntitySubtreeQueryPortSqlite.ts`
- `packages/core/src/infrastructure/sqlite/EntityTypeRepositorySqlite.ts`
- `packages/core/src/infrastructure/sqlite/FieldEncryptionServiceSqlite.ts`
- `packages/core/src/infrastructure/sqlite/LockRepositorySqlite.ts`
- `packages/core/src/infrastructure/sqlite/LoginRateLimitPortSqlite.ts`
- `packages/core/src/infrastructure/sqlite/MfaTotpPortSqlite.ts`
- `packages/core/src/infrastructure/sqlite/NodeRepositorySqlite.ts`
- `packages/core/src/infrastructure/sqlite/NodeTypeRepositorySqlite.ts`
- `packages/core/src/infrastructure/sqlite/RealtimeOutboxSqlite.ts`
- `packages/core/src/infrastructure/sqlite/ResourcePurgeRepositorySqlite.ts`
- `packages/core/src/infrastructure/sqlite/ResourceRelationshipDefinitionReaderSqlite.ts`
- `packages/core/src/infrastructure/sqlite/ResourceRelationshipRepositorySqlite.ts`
- `packages/core/src/infrastructure/sqlite/RevisionPortSqlite.ts`
- `packages/core/src/infrastructure/sqlite/RuntimeConfigurationPortSqlite.ts`
- `packages/core/src/infrastructure/sqlite/SecurityRepositorySqlite.ts`
- `packages/core/src/infrastructure/sqlite/ServiceConfigurationRepositorySqlite.ts`
- `packages/core/src/infrastructure/sqlite/SessionRepositorySqlite.ts`
- `packages/core/src/infrastructure/sqlite/SqliteDatabase.ts`
- `packages/core/src/infrastructure/sqlite/SqliteInfrastructure.ts`
- `packages/core/src/infrastructure/sqlite/StorageTableManagementSqlite.ts`
- `packages/core/src/infrastructure/sqlite/SystemConfigRepositorySqlite.ts`
- `packages/core/src/infrastructure/sqlite/SystemSeedSqlite.test.ts`
- `packages/core/src/infrastructure/sqlite/SystemSeedSqlite.ts`
- `packages/core/src/infrastructure/sqlite/TransactionPortSqlite.test.ts`
- `packages/core/src/infrastructure/sqlite/TransactionPortSqlite.ts`
- `packages/core/src/infrastructure/sqlite/TypeDefinitionAdminRepositorySqlite.ts`
- `packages/core/src/infrastructure/sqlite/TypeDefinitionReaderSqlite.ts`
- `packages/core/src/infrastructure/sqlite/UserRepositorySqlite.ts`
- `packages/core/src/infrastructure/sqlite/WorkflowRepositorySqlite.ts`
- `packages/web/src/app/account/complete/_components/AccountCompletionForm.tsx`
- `packages/web/src/app/actions/accountRecoveryActions.test.ts`
- `packages/web/src/app/actions/adminAccessActions.test.ts`
- `packages/web/src/app/actions/adminAccessActions.ts`
- `packages/web/src/app/actions/errorMapping.ts`
- `packages/web/src/app/api/attachments/[attachmentId]/route.ts`
- `packages/web/src/app/api/attachments/attachmentAccess.test.ts`
- `packages/web/src/app/api/attachments/attachmentAccess.ts`
- `packages/web/src/app/api/attachments/attachmentHttp.ts`
- `packages/web/src/app/api/attachments/route.ts`
- `packages/web/src/app/attachments/attachmentClient.test.ts`
- `packages/web/src/app/attachments/attachmentClient.ts`
- `packages/web/src/app/attachments/useAttachmentCollection.ts`
- `packages/web/src/app/components/ui/forms/AttachmentList.tsx`
- `packages/web/src/app/components/ui/forms/dynamicResourceForm.test.ts`
- `packages/web/src/app/components/ui/forms/dynamicResourceForm.ts`
- `packages/web/src/app/hooks/useLock.release.test.ts`
- `packages/web/src/app/hooks/useLock.ts`
- `packages/web/src/app/i18n/AppLocaleStore.ts`
- `packages/web/src/app/nodes/[nodeId]/_components/NodeAccessDenied.tsx`
- `packages/web/src/app/nodes/[nodeId]/_components/NodeEditorPanel.tsx`
- `packages/web/src/app/nodes/[nodeId]/_hooks/useNodeDetail.ts`
- `packages/web/src/app/nodes/[nodeId]/entities/[entityId]/_components/EntityDetailContent.tsx`
- `packages/web/src/app/nodes/[nodeId]/entities/[entityId]/_components/EntityDetailScreen.tsx`
- `packages/web/src/app/nodes/[nodeId]/entities/[entityId]/_hooks/useEntityDetailController.ts`
- `packages/web/src/app/nodes/[nodeId]/entities/new/_hooks/useCreateEntity.ts`
- `packages/web/src/app/nodes/[nodeId]/new/_hooks/useCreateChildNode.ts`
- `packages/web/src/app/nodes/[nodeId]/page.tsx`
- `packages/web/src/server/ArchitectureCompliance.test.ts`
- `packages/web/src/server/PostgresResourceSecurityPolicyResolver.ts`
- `packages/web/src/server/db.ts`
