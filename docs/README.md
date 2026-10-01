# Documentazione Nodriva

[Italiano](README.md) | [English](README.en.md)

Questa pagina è l'indice italiano della documentazione corrente. I documenti
sono organizzati per lingua: ogni guida pubblicata deve avere una versione
italiana e una inglese, senza alternare paragrafi di lingue diverse. Codice,
nomi di variabili, identificatori SQL, route e chiavi tecniche restano invariati
nelle due versioni.

## Installazione e gestione

- [Installazione](INSTALLATION.md) · [English](INSTALLATION.en.md)
- [Primo accesso](FIRST_RUN.md) · [English](FIRST_RUN.en.md)
- [Operatività Node.js](NODE_OPERATIONS.md) · [English](NODE_OPERATIONS.en.md)
- [Modello di deployment](DEPLOYMENT_MODEL.md) · [English](DEPLOYMENT_MODEL.en.md)
- [Compose completo](DOCKER_COMPOSE_FULL.md)
- [Readiness operativa](OPERATIONS_READINESS.md) · [English](OPERATIONS_READINESS.en.md)
- [Checklist di rilascio](RELEASE_CHECKLIST.md) · [English](RELEASE_CHECKLIST.en.md)
- [Backup e restore](BACKUP_RESTORE.md) · [English](BACKUP_RESTORE.en.md)
- [Operazioni backup](BACKUP_OPERATIONS.md) · [English](BACKUP_OPERATIONS.en.md)
- [Gestione segreti](SECRET_MANAGEMENT.md)
- [Sicurezza operativa](SECURITY_OPERATIONS.md)

## Contratti tecnici

- [Governance architetturale](ARCHITECTURAL_GOVERNANCE.md) · [English](ARCHITECTURAL_GOVERNANCE.en.md)
- [Portabilità architetturale](ARCHITECTURAL_PORTABILITY.it.md) · [English](ARCHITECTURAL_PORTABILITY.md)
- [Configurazione runtime](RUNTIME_CONFIGURATION_CATALOG.md)
- [Configurazione servizi](SERVICE_CONFIGURATION_ARCHITECTURE.md)
- [Ciclo realtime](REALTIME_MUTATION_LIFECYCLE.md)
- [Sessione e lock](HUMAN_ACTIVITY_SESSION_LOCKS.md)
- [Lock amministrativi](ADMIN_LOCKS.md) · [English](ADMIN_LOCKS.en.md)
- [Audit](AUDIT_RECORDING_POLICY.md) · [English](AUDIT_RECORDING_POLICY.en.md)
- [Storage allegati](ATTACHMENT_STORAGE_FORMAT.it.md) · [English](ATTACHMENT_STORAGE_FORMAT.md)
- [Internazionalizzazione backend](BACKEND_I18N.it.md) · [English](BACKEND_I18N.md)
- [Rotazione cifratura](ENCRYPTION_ROTATION.md) · [English](ENCRYPTION_ROTATION.en.md)
- [Relazioni](RESOURCE_RELATIONSHIP_ARCHITECTURE.it.md) · [English](RESOURCE_RELATIONSHIP_ARCHITECTURE.md)
- [Tipi e metadati](RESOURCE_METADATA_FORMS.md)
- [Enum](MANAGED_ENUMS.md) · [English](MANAGED_ENUMS.en.md)
- [Ciclo di vita tipi](TYPE_LIFECYCLE.md)
- [Workflow](WORKFLOW_EVENT_ENGINE.it.md) · [English](WORKFLOW_EVENT_ENGINE.md)

## Amministrazione e frontend

- [Architettura informativa Admin](ADMIN_INFORMATION_ARCHITECTURE.md)
- [Cataloghi semantici](ADMINISTRATIVE_UX_SEMANTIC_CATALOGS.it.md) · [English](ADMINISTRATIVE_UX_SEMANTIC_CATALOGS.md)
- [Stato workspace](ADMIN_WORKSPACE_STATE.it.md) · [English](ADMIN_WORKSPACE_STATE.md)
- [Collection realtime](ADMIN_REALTIME_COLLECTIONS.md) · [English](ADMIN_REALTIME_COLLECTIONS.en.md)
- [Flusso dati frontend](FRONTEND_DATA_FLOW_STANDARD.md)
- [Responsive UI](RESPONSIVE_UI.md)

## Sviluppo e governance

- [Workflow di sviluppo](DEVELOPMENT_WORKFLOW.md)
- [Governance documentazione](DOCUMENTATION_GOVERNANCE.md)
- [Checklist accettazione](NODRIVA_ACCEPTANCE_CHECKLIST.md)
- [Architettura](../ARCHITECTURE.it.md) · [English](../ARCHITECTURE.md)
- [Contributi](../CONTRIBUTING.it.md) · [English](../CONTRIBUTING.md)
- [Policy sicurezza](../SECURITY.it.md) · [English](../SECURITY.md)

I documenti storici, le bozze di progetto, gli ADR archiviati e i report di
analisi non fanno parte della documentazione pubblicata e sono esclusi da Git.
L'unica eccezione è `Specifiche/dashboard_v4_schema_corrected.sql`, schema SQL
eseguibile ancora richiesto dai bootstrap e quindi versionato.
