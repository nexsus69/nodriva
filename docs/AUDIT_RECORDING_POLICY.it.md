# Politica di registrazione dell'audit

Le mutazioni autorizzate persistono dato, audit e outbox nella stessa
transazione. Il record identifica attore, azione, risorsa, scope, esito e
metadati utili senza includere segreti o payload sensibili non necessari.

I dinieghi applicativi sono distinti dai guasti infrastrutturali. L'audit è
append-only, consultabile secondo scope e conservato secondo la policy
operativa; non sostituisce i log tecnici.
