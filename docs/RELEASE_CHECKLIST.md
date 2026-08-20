# Checklist di rilascio

Questa checklist distingue ciò che viene verificato automaticamente da ciò che
richiede un ambiente controllato. Un rilascio non deve usare il database,
gli allegati o i secret dell'ambiente di sviluppo.

## Verifiche automatiche

- [x] La CI GitHub Actions è verde sul commit da rilasciare (`e7effaf`).
- [ ] Il job PostgreSQL ha applicato schema e migrazioni da zero, convertito il
      fixture legacy, riapplicato le migrazioni, verificato il ruolo ristretto
      ed eseguito integrazioni e parità adapter senza skip.
- [ ] `pnpm install --frozen-lockfile` completa senza modificare il lockfile.
- [x] `pnpm check` completa con typecheck, lint, test e build production.
- [x] Non ci sono modifiche locali o file secret inclusi nel commit.
- [ ] Il changelog o le note di rilascio descrivono migrazioni, breaking change
      e variabili nuove.

## Verifiche in ambiente isolato

- [ ] PostgreSQL di test inizializzato da schema e migration correnti.
- [ ] Suite di integrazione PostgreSQL eseguita contro un database con nome
      dedicato `*_test`.
- [ ] E2E autenticato eseguito con utenti e dati temporanei.
- [ ] `pnpm e2e:admin-parity` eseguito: sezioni, mutation, dettagli e audit
      amministrativi equivalenti su SQLite e PostgreSQL.
- [ ] `pnpm e2e:canonical` eseguito: schema dinamico, scope, due sessioni,
      lock, `rowVersion`, relazioni, delete/restore e audit equivalenti; in
      alternativa `pnpm e2e:parity` ha eseguito entrambi gli scenari.
- [ ] Verificati login, ACL, scope `self/subtree`, deny, lock concorrenti,
      revoca realtime e accessi diretti non autorizzati.
- [ ] Verificati upload, download, antivirus, cifratura e rimozione allegati
      se le capability sono abilitate nel deployment.
- [ ] Verificato il comportamento con realtime disabilitato.
- [ ] Verificato il profilo standalone SQLite se il rilascio dichiara supporto
      standalone.

## Database, dati e sicurezza

- [x] Backup PostgreSQL creato e ripristinato con successo in un database
      temporaneo.
- [ ] Se gli allegati sono abilitati, copia e restore del volume allegati
      coordinati con il dump PostgreSQL e verificati su payload reali.
- [ ] Chiavi di cifratura presenti nel secret manager e non nei file versionati.
- [ ] Migrazioni applicate in ordine, percorso di upgrade e riapplicazione
      verificati, ruolo applicativo ristretto verificato.
- [ ] Policy HTTPS, cookie, proxy e WebSocket verificate fuori dall'ambiente
      locale.
- [x] Retention audit, backup, log e metriche definite per il deployment.
- [ ] Nessun lock attivo residuo creato dai test.

## Deployment e rollback

- [x] Immagine production identificata con digest Docker (`sha256:9ec8e927...`).
- [ ] Volumi persistenti e secret inclusi nel piano di ripristino.
- [ ] Procedura di rollback provata o almeno verificata sullo stesso schema.
- [ ] Operatore responsabile e finestra di manutenzione registrati.
- [ ] Dopo il deploy: healthcheck, login, navigazione, mutation controllata e
      metriche realtime verificati.

## Stato del repository

Il workflow CI copre il percorso automatico. La presenza di questa checklist
non rende automaticamente production-ready un deployment: Compose modulare,
secret manager, HTTPS, replica, retention e disaster recovery restano
responsabilità dell'ambiente operativo e delle attività ancora aperte nella
TODO architetturale.

## Esito della verifica locale 2026-08-20

Verificati localmente: backup/restore su database temporaneo, healthcheck dello
stack tramite proxy, endpoint HTTPS, regole e target Prometheus, retention
Prometheus, `pnpm check` e working tree pulito. Le integrazioni PostgreSQL
locali non sono state considerate superate perché il Compose non espone il
database all'host; la verifica autorizzativa resta quella del job CI dedicato
`postgres-integration`, completato con successo sul commit `e7effaf`.

Restano non verificabili in questo ambiente e quindi bloccanti per la
certificazione production-ready: secret manager/KMS reale, consegna esterna
degli alert, copia off-host cifrata del backup e del volume allegati, e prova
di rollback nell'infrastruttura target.
