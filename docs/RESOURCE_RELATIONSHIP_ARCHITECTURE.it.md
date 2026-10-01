# Architettura delle relazioni tra risorse

[Italiano](RESOURCE_RELATIONSHIP_ARCHITECTURE.it.md) | [English](RESOURCE_RELATIONSHIP_ARCHITECTURE.md)

## Stato

Questo documento definisce il contratto obiettivo per relazioni tipizzate tra
risorse Nodriva. Sostituisce l'assunzione precedente secondo cui un campo
`relation` fosse solo un UUID conservato nel payload.

## Posizionamento

| Responsabilità | Bounded context | Layer | Fase transazione |
| --- | --- | --- | --- |
| Definizione e cardinalità relazione | Type System | DTO Domain/Application | transazione metadata |
| Lifecycle edge | Entity Domain / Hierarchy | servizio Application | transazione risorsa |
| Persistenza edge | Infrastructure relazioni | adapter Infrastructure | transazione risorsa |
| Audit ed eventi realtime | Governance | Application/Infrastructure | dopo edge, prima/dopo commit |
| Editor relazione e pannello inverso | Frontend Read Model | Presentation | solo client |

Il servizio applicativo può dipendere da repository risorse, type-definition
reader, autorizzazione, lock, audit, revisione, transazione e port
`ResourceRelationshipRepository`. Non deve dipendere da SQL, framework o stato
UI. Gli adapter PostgreSQL e SQLite implementano lo stesso port.

## Contratto della definizione

Ogni campo `relation` definisce:

- tipo risorsa sorgente e chiave campo;
- tipo risorsa target;
- cardinalità sorgente: `one` o `many`;
- eventuale unicità target, che rende il lato target `one` e consente una
  relazione strettamente uno-a-uno quando la sorgente è `one`;
- etichetta inversa opzionale per il pannello entrante;
- policy di eliminazione esplicita. La policy iniziale supportata è `restrict`.

I campi esistenti migrano con cardinalità sorgente `one`, unicità target
`false` e policy `restrict`. Il valore osservabile del form resta un singolo
identificativo finché il campo non viene cambiato deliberatamente in `many`.

## Contratto delete e restore

`restrict` è applicato da `ResourceDeletionPolicyService` nella stessa
transazione di ogni soft delete. Un deletion set comprende un'entità oppure,
per un subtree nodo, ogni nodo ed entità contenuta cancellata dal batch. Solo
edge entranti attivi con sorgente esterna al set bloccano la cancellazione; i
riferimenti interni al subtree non la bloccano. Gli edge uscenti restano con
`suspended_at` valorizzato (`NULL` significa attivo) e vengono riattivati al
restore.

Ogni sospensione conserva anche `suspension_deletion_batch_id`; il restore
riattiva solo gli edge marcati dal batch ripristinato e preserva edge più vecchi
o sospesi indipendentemente.

Il rifiuto stabile è `RESOURCE_DELETE_RESTRICTED` con identità risorsa,
`totalReferencerCount` e `referencers`. Il conteggio comprende ogni edge
esterno attivo; `referencers` contiene solo dominio, id, tipo e nome risolti dal
batch e leggibili dall'attore. I riferimenti nascosti sono conteggiati ma mai
esposti.

L'hydration del read model riceve l'attore, legge solo edge attivi, esclude
target soft-deleted del batch e filtra i target rimanenti per
`node.read` e `entity.read` sul nodo padre. La proiezione interna di persistenza
resta volutamente non filtrata, così l'aggiornamento di un campo indipendente
non cancella un edge canonico nascosto.

### Ordine dei lock relazionali

Ogni lock di relazione multi-risorsa usa l'ordine totale `(domain, id)` in
ordine lessicografico crescente (`entity` prima di `node`, poi testo UUID).
Le query PostgreSQL conservano l'ordine con `ORDER BY id` prima di `FOR UPDATE`
o `FOR KEY SHARE`; SQLite applica la stessa normalizzazione, anche se la
transazione standalone serializza i writer.

## Dati canonici e compatibilità

`resource_relationships` è lo store canonico. Una riga è un edge identificato
da campo sorgente, risorsa sorgente e risorsa target; conserva anche i domini,
così gli identificativi nodo ed entità non possono essere confusi.

Durante la migrazione di compatibilità, colonne e payload relation esistenti
restano solo dati di lettura. Le mutazioni applicative scrivono prima l'edge
canonico nella stessa transazione e lo proiettano nello storage legacy finché
quel formato dinamico è richiesto. Le nuove letture vengono hydrate dagli edge
canonici. Nessun componente UI legge o scrive direttamente la rappresentazione
legacy.

## Contratto di mutazione

Il layer applicativo espone un insieme unico di operazioni: sostituzione dei
valori uscenti, link, unlink, riordino e link/unlink bulk dal lato inverso. Ogni
operazione verifica tipo sorgente/target, visibilità e scope dell'attore,
`rowVersion` sorgente e cardinalità. Scrive righe edge coinvolte, revisione
risorsa e audit completo nella stessa transazione.

I form ordinari richiedono il lock posseduto dall'attore quando il locking è
abilitato. Un'operazione inversa bulk non ha una superficie edit per ogni
sorgente: usa quindi una policy batch deliberata, rifiuta ogni sorgente
bloccata da un'altra sessione e controlla ogni versione inviata. Evita di
sovrascrivere un form aperto e consente di collegare una risorsa a molte
sorgenti senza aprirle e bloccarle una per una.

Le operazioni bulk seguono un protocollo esplicito:

1. `RelationshipMutationPlanner` valida source/target, autorizzazione e
   versioni inviate e produce un `RelationshipMutationPlan` non durevole;
2. la UI mostra gli effetti calcolati. Cambiare una relazione singola esistente
   è `replace`, mai un `link` implicito: l'attore conferma esplicitamente ogni
   sostituzione;
3. `ResourceRelationshipMutationService` prepara di nuovo il piano dentro una
   transazione; `BatchMutationConcurrencyGuard` rifiuta sorgenti bloccate da
   altra sessione e `RelationshipMutationCommitter` delega le scritture a
   `ResourceRelationshipMutationWriter`.

Il piano è un'anteprima, non una prenotazione durevole né una seconda cache. Non
è persistito perché nessuna azione UI può dipendere da un piano stale: il commit
rilegge righe sorgente e ricontrolla ACL, lock, cardinalità e ogni `rowVersion`.
PostgreSQL acquisisce lock brevi durante gli update atomici; SQLite serializza
la transazione standalone. L'esito è identico: un cambiamento concorrente fa
fallire l'intero batch e non consente overwrite parziale o silenzioso.

Per default le operazioni bulk sono all-or-nothing. Il comando porta la versione
attesa di ogni sorgente; un membro stale, bloccato o non autorizzato rifiuta la
richiesta completa invece di cambiare solo alcune risorse. Un futuro comando
best-effort esplicito potrà restituire esiti per risorsa, ma non indebolire
silenziosamente questo default.

## Contratto di presentazione

`RelationEditor` rende il campo secondo metadata: selettore singolo per `one` e
multi-select ordinato per `many`. `RelationPanel` è generato dagli stessi
metadata nella superficie dettaglio e mostra edge uscenti ed entranti. L'azione
bulk inversa richiede prima l'anteprima server comune e invoca il comando solo
dopo la revisione. Non modifica localmente il payload cached di un'altra
risorsa e non deduce semantiche replace dai dati client.

Tutti i candidati, le label e le righe inverse sono filtrati ACL dal server.
Cache e notifiche realtime usano identificativi risorsa canonici e non deducono
la completezza della relazione da una vista.

## Requisiti di verifica

Ogni modifica relazionale richiede contract test SQLite/PostgreSQL per
cardinalità, tipo target, autorizzazione, deletion policy, audit, conflitti
`rowVersion` e rollback. I test unitari coprono ogni impatto puro e il gate di
conferma in modo indipendente. L'E2E browser copre relazione creata sia
dall'editor sorgente sia dal pannello inverso, con revisione replace, reload e
propagazione realtime quando abilitata.
