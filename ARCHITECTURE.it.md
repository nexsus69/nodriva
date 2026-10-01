# Architettura Nodriva

[Italiano](ARCHITECTURE.it.md) | [English](ARCHITECTURE.md)

## Stato e obiettivo

Questa è l'edizione italiana del contratto architetturale corrente. Nodriva è
un monolite modulare con confini interni espliciti, tipi dinamici, tabelle
relazionali dedicate e frontend configurabile. PostgreSQL è il profilo completo;
SQLite è lo standalone; Compose è un profilo di riferimento, non una dipendenza.

## Regole dei layer

Le dipendenze puntano verso l'interno: Presentation dipende dai contratti
Application; Application dipende da Domain e port; Infrastructure implementa i
port senza diventare l'owner delle regole di business. Web non accede direttamente
a database o adapter.

Domain contiene invarianti e errori senza framework o SQL. Application orchestra
casi d'uso, transazioni, audit, outbox e invalidazioni. Infrastructure implementa
PostgreSQL, SQLite, cache, DDL e connettori. Presentation compone schermate e
cache senza assumere layout o persistenza fissi.

## Invarianti

Le mutation critiche verificano autorizzazione, lock e `rowVersion` nello stesso
confine transazionale della scrittura. Audit e outbox richiesti sono persistiti
prima degli effetti post-commit. PostgreSQL usa lock di policy; SQLite usa il
proprio gate serializzato mantenendo lo stesso risultato osservabile.

PostgreSQL e SQLite devono produrre gli stessi esiti, errori, ordinamenti,
rollback, visibilità e autorizzazione. Differenze come `ltree`/closure table o
tabelle dinamiche/JSON restano negli adapter.

La risoluzione schema passa da `TypeDefinitionReader`, `FieldSchemaCompiler` e
`CachingSchemaRegistry`; non sono ammessi compiler o cache paralleli. Le mutation
degli allegati appartengono a `AttachmentApplicationService` e riusano ACL,
lock, versione, audit e outbox.

Per la matrice completa di componenti, contesti e dipendenze consultare
l'edizione [inglese](ARCHITECTURE.md), normativa e tecnicamente equivalente.
