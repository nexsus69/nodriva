# Dashboard Ultimate — release candidate (2026-08-20)

## Stato

Questa candidata consolida la verticale project operations e i flussi di
cache, breadcrumb e caricamento UI. Il commit sorgente è `7c883cf`.

## Verifiche concluse

- backup PostgreSQL con checksum e restore strutturale in database temporaneo
  `*_test_*`;
- healthcheck dell'intero Compose, endpoint applicativo, backup verificato e
  target Prometheus attivo;
- bootstrap da schema vuoto, percorso di upgrade da schema legacy,
  riapplicazione idempotente delle migrazioni e ruolo applicativo ristretto;
- `pnpm check`: typecheck, lint, test Core/Web e build production Web;
- Prometheus con retention esplicita di 30 giorni e regole realtime caricate e
  valutate senza errori;
- working tree ripulito preservando in uno stash separato le modifiche locali
  preesistenti non pertinenti alla release.

## Prerequisiti di deployment

Questi punti non sono verificabili dal container locale e devono essere chiusi
nell'ambiente target prima del rilascio pubblico:

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
