# Recycle bin: causal operations

[English](RECYCLE_BIN_SEMANTICS.en.md) | [Italiano](RECYCLE_BIN_SEMANTICS.md)

## Normative status

The recycle bin represents user deletion intents, not a flat list of every
record that became a consequence.

## Deleting a node

Soft deletion of a node creates an immutable `deletionBatchId`. The batch
contains the root node, every descendant node and active entity contained in
the subtree at the time of the operation. It is one user operation.

The UI shows only the batch root with the number of affected nodes and entities.
Descendants and entities are operation details, not actionable rows. Restore
and purge always act on the entire batch.

## Deleting an entity

An entity deleted directly has no `deletionBatchId` and is one independent
recycle-bin operation. It may be restored or permanently deleted independently,
subject to authorization, `rowVersion`, an active parent node and active type.

## Authorization and states

The backend remains authoritative for `node.restore`, `node.purge`,
`entity.restore`, `entity.purge`, scope and locks. The UI does not offer actions
on batch consequences, avoiding presentation of an action as independent when
the backend applies it to the entire subtree.

Every mutation invalidates all recycle-bin projections it may affect; a manual
refresh is not required to align the observed result.
