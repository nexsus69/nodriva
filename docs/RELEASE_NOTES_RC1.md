# Dashboard Ultimate — release candidate (2026-08-20)

## Stato

Questa candidata consolida la verticale project operations e i flussi di
cache, breadcrumb e caricamento UI. Il commit sorgente è `e7effaf`.

## Verifiche concluse

- backup PostgreSQL con checksum e restore strutturale in database temporaneo
  `*_test_*` eseguito il 20 agosto 2026;
- healthcheck dell'intero Compose sull'endpoint proxy `http://192.168.3.247`,
  backup verificato e target Prometheus attivo;
- bootstrap da schema vuoto, percorso di upgrade da schema legacy,
  riapplicazione idempotente delle migrazioni e ruolo applicativo ristretto;
- `pnpm check`: typecheck, lint, test Core/Web e build production Web;
- Prometheus con retention esplicita di 30 giorni e regole realtime caricate e
  valutate senza errori;
- working tree ripulito dopo aver spostato fuori repository l'artefatto di
  backup usato per la verifica;

## Prerequisiti di deployment

Questi punti restano prerequisiti esterni e impediscono di dichiarare la
release formalmente production-ready finché non vengono verificati nel target:

- terminazione HTTPS con certificati, cookie e WebSocket verificati;
- segreti forniti da secret manager/KMS, senza valori operativi nei file
  versionati;
- consegna degli alert Prometheus a Alertmanager o sistema equivalente,
  inclusi alert su backup fallito/obsoleto e spazio disco;
- copia dei backup e del volume allegati fuori host, cifrata e con retention
  approvata;
- immagine pubblicata con digest immutabile e rollback provato sullo stesso
  schema e con backup corrente.

Il Compose completo resta quindi un profilo di sviluppo/staging replicabile:
la certificazione production-ready richiede l'esecuzione di questi controlli
nel deployment reale.
