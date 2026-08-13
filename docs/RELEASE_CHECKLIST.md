# Checklist di rilascio

Questa checklist distingue ciò che viene verificato automaticamente da ciò che
richiede un ambiente controllato. Un rilascio non deve usare il database,
gli allegati o i secret dell'ambiente di sviluppo.

## Verifiche automatiche

- [ ] La CI GitHub Actions è verde sul commit da rilasciare.
- [ ] Il job PostgreSQL ha applicato schema e migrazioni da zero, verificato il
      ruolo ristretto ed eseguito integrazioni e parità adapter senza skip.
- [ ] `pnpm install --frozen-lockfile` completa senza modificare il lockfile.
- [ ] `pnpm check` completa con typecheck, lint, test e build production.
- [ ] Non ci sono modifiche locali o file secret inclusi nel commit.
- [ ] Il changelog o le note di rilascio descrivono migrazioni, breaking change
      e variabili nuove.

## Verifiche in ambiente isolato

- [ ] PostgreSQL di test inizializzato da schema e migration correnti.
- [ ] Suite di integrazione PostgreSQL eseguita contro un database con nome
      dedicato `*_test`.
- [ ] E2E autenticato eseguito con utenti e dati temporanei.
- [ ] `pnpm e2e:admin-parity` eseguito: sezioni, mutation, dettagli e audit
      amministrativi equivalenti su SQLite e PostgreSQL.
- [ ] Verificati login, ACL, scope `self/subtree`, deny, lock concorrenti,
      revoca realtime e accessi diretti non autorizzati.
- [ ] Verificati upload, download, antivirus, cifratura e rimozione allegati
      se le capability sono abilitate nel deployment.
- [ ] Verificato il comportamento con realtime disabilitato.
- [ ] Verificato il profilo standalone SQLite se il rilascio dichiara supporto
      standalone.

## Database, dati e sicurezza

- [ ] Backup PostgreSQL creato e ripristinato con successo in un database
      temporaneo.
- [ ] Chiavi di cifratura presenti nel secret manager e non nei file versionati.
- [ ] Migrazioni applicate in ordine e ruolo applicativo ristretto verificato.
- [ ] Policy HTTPS, cookie, proxy e WebSocket verificate fuori dall'ambiente
      locale.
- [ ] Retention audit, backup, log e metriche definite per il deployment.
- [ ] Nessun lock attivo residuo creato dai test.

## Deployment e rollback

- [ ] Immagine production identificata con commit o tag immutabile.
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
