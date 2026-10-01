# UX amministrativa e cataloghi semantici

## Scopo

Le interfacce amministrative traducono i contratti tecnici stabili di Nodriva
in attività chiare e sicure. Non devono richiedere di ricordare o digitare un
identificativo interno solo perché è quello persistito dall'API. Questo
documento è normativo per ogni modulo amministrativo esistente o nuovo.

Non indebolisce i contratti backend: autorizzazione, validazione, chiavi
immutabili, versionamento, scope e concorrenza restano verificati da
Application e Domain. Definisce il modo in cui il Web espone tali contratti.

## Valori umani e tecnici

Ogni concetto configurabile può avere due rappresentazioni:

- **valore umano**: nome localizzato, spiegazione concisa e, quando utile,
  contesto di dominio come tipo soggetto, stato o rischio;
- **valore tecnico**: identificativo stabile inviato tramite il contratto
  applicativo tipizzato e memorizzato dal backend.

La UI usa il valore umano come rappresentazione primaria. Il valore tecnico è
visibile quando aiuta amministrazione, diagnosi o copia, ma è secondario e non è
mai l'unica etichetta. Un elemento storico assente dal catalogo resta visibile
con un fallback esplicito `non disponibile/legacy` che contiene il valore
tecnico; non deve diventare silenziosamente un'altra scelta.

## Regola dei cataloghi

Quando i valori possibili sono finiti e conoscibili dall'applicazione, il server
espone un catalogo autorizzato e la UI Web lo consuma tramite cache/coordinator.
Il controllo è un selettore ricercabile, un command picker o una checklist
adeguata alla cardinalità. Ogni opzione contiene almeno etichetta e valore
tecnico, oltre a una descrizione quando la scelta non è autoesplicativa.

Esempi sono chiavi di azioni audit, tipi di risorsa, eventi e azioni workflow,
ruoli, permessi, tipi, stati del ciclo di vita ed effetti delle assegnazioni.
Un filtro audit presenta quindi “Aggiornamento entità” e invia `entity.update`;
non chiede di digitare quest'ultimo.

Il testo libero è consentito solo per valori realmente aperti, come ID risorsa,
ricerca full-text, nome scritto dall'utente o espressione avanzata documentata.
Non è una scorciatoia per omettere un catalogo finito. Se il catalogo è molto
grande può essere ricercabile lato server e paginato, ma resta semantico.

## Chiavi e nomi

Le chiavi tecniche sono identificativi stabili, non titoli. I form che creano un
oggetto di configurazione devono:

1. raccogliere prima nome leggibile e descrizione opzionale;
2. proporre una chiave tecnica normalizzata dal nome quando necessaria;
3. spiegare la grammatica accettata e validarla subito nel client;
4. applicare la stessa regola nel backend;
5. consentire a un utente autorizzato di sovrascrivere la proposta solo in una
   sezione avanzata esplicita;
6. conservare la chiave esatta dopo la pubblicazione se l'oggetto è immutabile.

La normalizzazione automatica non può rinominare inaspettatamente un oggetto
pubblicato. Le chiavi legacy restano leggibili ed eseguibili salvo migrazione
esplicita e versionata.

## Flussi di configurazione

La configurazione complessa segue il progressive disclosure:

1. identificare l'oggetto e il suo scopo;
2. selezionare l'evento o contesto d'innesco da un catalogo semantico;
3. selezionare e configurare una o più azioni supportate;
4. aggiungere condizioni, gestione errori e parametri avanzati opzionali;
5. rivedere, validare, testare quando supportato e pubblicare o attivare.

L'interfaccia mostra un riepilogo compatto della configurazione e conserva
bozza, filtri, risorsa selezionata e passo del wizard tramite il contratto di
stato del workspace amministrativo. Le versioni pubblicate immutabili sono
distinte dalle bozze modificabili. Un grafo/canvas è appropriato solo quando
rami, join o dipendenze rendono ambiguo il percorso sequenziale; deve
completare, non sostituire, form e riepiloghi accessibili.

## Sicurezza e accesso

I cataloghi sono read model, non concessioni di autorizzazione. Quando serve,
sono filtrati per l'attore corrente e ogni valore tecnico inviato è validato di
nuovo dal backend. La UI distingue catalogo autorizzato vuoto, caricamento e
servizio non disponibile. Un errore nel recupero non deve diventare né una
selezione vuota né un bypass tramite testo libero.

## Consegna e test

Ogni conversione di una schermata che accetta input tecnico è una modifica
verticale:

- definire o riusare il contratto di catalogo tipizzato nel corretto confine
  applicativo;
- esporlo tramite convenzioni esistenti di cache e Server Action;
- renderizzare etichette, descrizioni, ricerca e fallback legacy esplicito;
- conservare filtri, bozze e stato workspace con `useAdminModuleState` quando
  applicabile;
- testare mapping etichetta→valore, stati vuoto/caricamento/non disponibile,
  valori selezionati stale o legacy, autorizzazione e validazione backend;
- estendere l'E2E amministrativo quando il cambiamento è visibile all'utente.

Le conversioni sono ordinate per frequenza, rischio e confusione attuale. Sono
incrementali: non sostituire ogni form amministrativo in un solo refactoring.

## Stato dell'implementazione

Il modulo audit è la prima conversione completata. I filtri di azione e tipo
risorsa caricano un catalogo autorizzato e in parità tra adapter, mostrano
etichette semantiche localizzate tramite il selettore condiviso e inviano i
valori tecnici originali. Lista e dettaglio audit usano le stesse etichette e
conservano l'identificativo esatto come contesto secondario.

La configurazione workflow usa lo stesso primitivo per i cataloghi di eventi e
azioni. Raccoglie prima un nome umano, propone una chiave `snake_case`, rende
esplicita la personalizzazione tecnica e conserva la bozza nel workspace Admin.
La creazione dei ruoli segue lo stesso schema nome-prima e chiave generata.

Cataloghi dei campi tipo, capability runtime, impostazioni runtime e permessi
risolvono ora i valori finiti di sistema nel catalogo semantico Web condiviso.
Il backend continua a restituire chiave tecnica persistita e dati legacy; la UI
mappa le chiavi note nella lingua selezionata e conserva label/descrizione
persistent come fallback esplicito per elementi storici o esterni. Nomi e
descrizioni scritti dall'utente restano contenuto utente e non vengono tradotti
silenziosamente.
