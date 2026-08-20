# Secret management con Infisical

La release strutturata usa Infisical self-hosted come archivio centralizzato
dei secret. L'istanza è separata dallo stack Dashboard e ascolta solo su
`127.0.0.1:8080`; non viene esposta direttamente su Internet.

## Bootstrap

1. Copiare `.env.infisical.example` fuori dal repository in `.env.infisical`,
   valorizzando password e chiavi generate casualmente, con permessi `0600`.
2. Avviare l'istanza:

   ```bash
   docker compose --env-file .env.infisical -f docker-compose.infisical.yml up -d
   ```

3. Creare il primo account amministratore tramite un tunnel SSH:

   ```bash
   ssh -L 8080:127.0.0.1:8080 <host>
   ```

   e aprire `http://127.0.0.1:8080` sul computer dell'operatore.
4. Creare un progetto `dashboard-ultimate`, gli ambienti necessari e una
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
