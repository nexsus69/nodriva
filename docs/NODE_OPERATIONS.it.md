# Operazioni sui nodi

Creazione, spostamento, aggiornamento e cancellazione dei nodi verificano scope,
lock, `rowVersion` e policy di eliminazione nello stesso confine transazionale.
Il cestino conserva audit e autorizzazioni; il ripristino ricontrolla lo scope.

La UI aggiorna il tree tramite controller e read model, non tramite accesso
diretto alla persistenza.
