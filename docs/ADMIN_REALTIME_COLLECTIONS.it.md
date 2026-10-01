# Raccolte realtime nel pannello

Le raccolte amministrative ricevono eventi solo dopo il commit della mutazione.
Il coordinatore verifica policy, versione e visibilità, quindi aggiorna o
invalida il read model. Polling e realtime passivi non rinnovano la sessione.

Gli stati di caricamento, errore, riconnessione e dato superato devono essere
espliciti. Il backend resta autorevole per autorizzazione, ordinamento e
concorrenza.
