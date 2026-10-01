# Architettura delle relazioni fra risorse

[Italiano](RESOURCE_RELATIONSHIP_ARCHITECTURE.it.md) | [English](RESOURCE_RELATIONSHIP_ARCHITECTURE.md)

Le relazioni sono edge tipizzati fra nodi ed entità. Definizione, cardinalità,
dominio, direzione e policy di cancellazione sono metadata amministrativi; le
istanze sono dati applicativi autorizzati.

La validazione verifica tipo sorgente e destinazione, cardinalità, scope e
duplicati prima della scrittura. Una conferma batch usa un'unica transazione:
lock, `rowVersion`, edge, revisioni, audit e outbox entrano nello stesso confine.
La sostituzione degli edge inversi segue la policy di cardinalità e non una
decisione client-side.

La cancellazione soft applica `restrict` agli edge incoming attivi non inclusi
nello stesso batch; gli outgoing vengono sospesi e possono essere riattivati al
restore. L'idratazione usa soltanto edge attivi e destinazioni non eliminate.

PostgreSQL e SQLite possono usare strutture interne differenti, ma devono
conservare ordinamento, errori, rollback, visibilità e audit osservabili. La UI
mostra preview e impatto; il backend ricalcola sempre la policy prima del commit.
