# Secret management con Infisical

La release strutturata usa Infisical self-hosted come archivio centralizzato
dei secret. L'istanza è separata dallo stack Dashboard; binding, endpoint
pubblico e porte sono dichiarati con le variabili `INFISICAL_*` del deployment.

## Bootstrap

1. Generare il file dei segreti fuori dal repository con lo script
   ripetibile (non sovrascrive un file esistente):

   ```bash
   ./scripts/infisical-init-env.sh
   ```

   In alternativa copiare `.env.infisical.example` fuori dal repository,
   valorizzare password e chiavi generate casualmente e impostare permessi
   `0600`.
2. Avviare l'istanza:

   ```bash
   docker compose --env-file .env.infisical -f docker-compose.infisical.yml up -d
   ```

3. Creare il primo account amministratore tramite un tunnel SSH:

   ```bash
   ssh -L "$INFISICAL_HOST_PORT:$INFISICAL_TUNNEL_HOST:$INFISICAL_PORT" <host>
   ```

   e aprire `$INFISICAL_PUBLIC_URL` sul computer dell'operatore.
4. Creare un progetto `nodriva`, gli ambienti necessari e una
   machine identity con permessi minimi di sola lettura per il deploy.
5. Conservare il token della machine identity fuori dal repository. Il token
   è il solo bootstrap secret del deploy e deve essere ruotabile.

Il database Infisical e la sua encryption key fanno parte del disaster
recovery: devono avere backup coordinato e non possono essere eliminati senza
una copia verificata. Redis contiene cache/job e può essere ricreato.

Il Dashboard non interroga Infisical durante le richieste utente: il deploy
recupera i secret e li consegna ai container tramite file protetti/Docker
secrets. In questo modo un'indisponibilità temporanea di Infisical non interrompe
una sessione già avviata.

## Export per il deploy

Una volta configurati i secret nel progetto, generare il file dotenv di runtime
fuori dal repository:

```bash
./scripts/infisical-export-env.sh \
  /home/marco/.config/nodriva/dashboard-production.env \
  .env.docker
```

Il file predefinito è
`/home/marco/.config/nodriva/dashboard-production.env`. Per usarlo
con il profilo Compose di base:

```bash
docker compose --env-file /home/marco/.config/nodriva/dashboard-production.env \
  -f docker-compose.full.yml up -d --build
```

Le integrazioni locali sono esplicite. Per il riferimento completo aggiungere
al comando Compose gli overlay `-f docker-compose.realtime.yml`,
`-f docker-compose.antivirus.yml`, `-f docker-compose.monitoring.yml` e
`-f docker-compose.backup.yml` secondo i servizi scelti.
I secret Pusher e del worker non sono richiesti se `realtime` non è abilitato.

Il secondo argomento contiene la configurazione operativa non segreta (bind
address, porte e intervalli). I secret eventualmente presenti nello stesso
file vengono sostituiti dai valori Infisical. L'export usa un token temporaneo
e non stampa mai i valori. Ripeterlo dopo una rotazione dei secret prima del
successivo deploy.
