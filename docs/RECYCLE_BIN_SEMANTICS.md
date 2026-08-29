# Cestino: operazioni causali

## Stato normativo

Il cestino rappresenta le intenzioni di eliminazione dell'utente, non una
lista piatta di ogni record che ne è stato conseguenza.

## Eliminazione di un nodo

La cancellazione soft di un nodo crea una `deletionBatchId` immutabile. La
batch comprende il nodo radice, tutti i nodi discendenti e le entità attive
contenute nel sottoalbero al momento dell'operazione. È una sola operazione
utente.

La UI mostra soltanto la radice della batch con il numero di nodi ed entità
coinvolti. Discendenti ed entità della batch sono dettaglio dell'operazione,
non righe azionabili. Ripristino e purge agiscono sempre sull'intera batch.

## Eliminazione di un'entità

Un'entità eliminata direttamente non ha `deletionBatchId` ed è una singola
operazione nel cestino. Può essere ripristinata o eliminata definitivamente
in modo indipendente, soggetta a autorizzazione, `rowVersion`, nodo genitore
attivo e tipo attivo.

## Autorizzazione e stati

Il backend continua a essere autorevole per `node.restore`, `node.purge`,
`entity.restore`, `entity.purge`, scope e lock. La UI non offre azioni su
conseguenze di batch, evitando di presentare come indipendente un'azione che
il backend esegue sull'intero sottoalbero.

Ogni mutazione invalida tutte le proiezioni del cestino che può influenzare;
un refresh manuale non è richiesto per allineare il risultato osservato.
