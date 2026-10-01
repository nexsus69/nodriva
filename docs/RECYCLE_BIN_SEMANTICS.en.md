# Recycle-bin semantics

[English](RECYCLE_BIN_SEMANTICS.en.md) | [Italiano](RECYCLE_BIN_SEMANTICS.md)

Deletion is soft unless an explicitly authorized purge is requested. A deleted
node or entity is hidden from normal reads while its metadata, audit and
relationships remain available to the governed recovery flow.

Incoming active relationships apply the `restrict` policy. Outgoing edges are
suspended and can be restored with the resource or deletion batch. Subtree
restore uses deletion-batch provenance and does not resurrect records deleted
independently before the cascade.

Restore and purge are separate permissions and application services. Scope,
lock, `rowVersion`, audit and relationship policy are checked again in the same
transaction as the mutation. Permanent purge is irreversible and must never be
used by tests against an operational database.
