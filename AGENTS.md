# Dashboard Ultimate — istruzioni operative

## Obiettivo del prodotto

Dashboard Ultimate è una piattaforma generica per modellare e gestire dati
operativi tramite nodi gerarchici, entità, tipi, campi, relazioni e allegati.
Non deve diventare un gestionale legato a un singolo dominio applicativo.

L'obiettivo corrente non è ampliare la piattaforma, ma consolidare una
verticale completa, comprensibile e affidabile. Prima di introdurre nuove
capability, stabilizzare i flussi già presenti e chiudere i relativi test,
documentazione e requisiti operativi.

Una richiesta esplicita dell'utente può cambiare priorità o perimetro. In
assenza di tale richiesta, non estendere autonomamente lo scope del prodotto.

## Profili supportati

### PostgreSQL completo

È il profilo principale per deployment completi e distribuiti. Comprende le
integrazioni configurate dal deployment, fra cui realtime, worker outbox,
antivirus, metriche, backup e proxy.

### SQLite standalone

Deve funzionare con Node.js e un file locale, senza richiedere servizi esterni.
Realtime, antivirus e altre integrazioni distribuite possono essere
deliberatamente disabilitati. Le funzionalità comuni devono però conservare lo
stesso risultato osservabile del profilo PostgreSQL.

Non imporre a SQLite i meccanismi interni di PostgreSQL. È ammesso usare
implementazioni differenti, per esempio closure table e JSON al posto di
`ltree` e tabelle dinamiche fisiche, purché i contratti applicativi e gli esiti
utente restino equivalenti.

## Verticale canonica da consolidare

Usare come percorso di riferimento il dominio demo project operations:

1. un superadmin accede al sistema;
2. configura o verifica tipi, campi, enum e relazioni;
3. crea un utente operativo e gli assegna ruolo e scope;
4. l'operatore accede e naviga soltanto il proprio perimetro;
5. crea nodi, progetti, attività e documenti;
6. modifica dati dinamici e allegati senza perdere la sessione mentre è attivo;
7. una seconda sessione esercita lock e concorrenza tramite `rowVersion`;
8. nel profilo completo gli aggiornamenti sono propagati tramite realtime;
9. cancellazione, cestino e ripristino mantengono scope e audit corretti;
10. l'amministratore verifica l'audit;
11. dati e schema possono essere recuperati con la procedura di backup/restore.

Il profilo SQLite deve coprire lo stesso percorso funzionale comune, escludendo
esplicitamente realtime e antivirus quando non configurati.

## Priorità corrente

Procedere in questo ordine, salvo richiesta esplicita diversa:

1. eseguire in CI integrazioni PostgreSQL, contract test ed E2E necessari;
2. distinguere dinieghi applicativi da guasti infrastrutturali nell'error
   handling amministrativo;
3. verificare e irrobustire sessione scorrevole, form non salvati e lock
   (completato: mantenere i test di regressione);
4. uniformare il bootstrap amministrativo PostgreSQL/SQLite;
5. completare lo scenario E2E della verticale canonica sui profili supportati;
6. rifattorizzare con test `ActivityProvider` e poi `VirtualGroupedTable`;
7. intervenire su `NodeTree` solo con una motivazione concreta e test di
   espansione, selezione, caricamento e realtime;
8. consolidare migrazioni, backup/restore, healthcheck e osservabilità.

## Perimetro rinviato

Non introdurre come effetto collaterale di altri task:

- nuovi provider infrastrutturali;
- nuovi database;
- nuove capability di prodotto;
- archivi allegati o nuovi formati complessi;
- nuove strategie di cache o riscritture generalizzate;
- configurazione universale di tutti i servizi dal pannello;
- generalizzazioni speculative prive di un caso d'uso della verticale.

Se una correzione richiede realmente una di queste estensioni, descrivere il
motivo e chiedere conferma prima di ampliare il perimetro.

## Confini architetturali

- Domain non dipende da framework, SQL o Infrastructure.
- Application orchestra casi d'uso e dipende solo da Domain e port.
- Infrastructure implementa i port senza ridefinire le regole di dominio.
- Web accede alla persistenza solo tramite servizi, port e composition root.
- SQL e caratteristiche specifiche del database restano negli adapter.
- Autorizzazione, validazione, lock e `rowVersion` sono sempre verificati dal
  backend; la UI e la cache non sono fonti autorevoli.
- Le transazioni persistono dato, audit e outbox richiesti prima degli effetti
  post-commit.
- Le differenze fra adapter sono accettabili solo se non cambiano il contratto
  o il risultato osservabile.

Consultare `ARCHITECTURE.md` e i documenti normativi in `docs/` prima di
modificare un contratto trasversale.

## Composizione frontend

- `page.tsx` e `layout.tsx` sono boundary sottili di composizione.
- Stato, effetti, reducer e transizioni appartengono a hook/controller.
- Gli screen compongono sezioni e modali; i componenti presentazionali ricevono
  dati e callback tipizzati.
- Non duplicare cache, coercizione dei form, mapping errori o protocolli di
  sessione in componenti diversi.
- Non dividere un modulo soltanto per ridurne il numero di righe: separarlo per
  responsabilità osservabili e preservarne le invarianti con test.
- Rispettare il guardrail automatico delle route in
  `packages/web/src/server/ArchitectureCompliance.test.ts`.

Quando si modifica codice Next.js sotto `packages/web`, leggere e rispettare
anche il relativo `packages/web/AGENTS.md` e la documentazione Next.js locale
da esso indicata.

## Sessione e lock

La sessione usa una scadenza scorrevole basata su attività umana reale, non una
scadenza fissa dal login. Digitazione, input e interazioni significative devono
mantenere attiva la sessione; polling e realtime passivi non devono farlo.

Il default corrente è 1800 secondi. Heartbeat, polling, TTL dei lock e intervalli
derivati devono discendere da un'unica policy temporale. Non introdurre timer
indipendenti o valori hardcoded divergenti.

Ogni modifica a sessione o lock deve coprire almeno attività continua,
inattività reale, ritorno dal background, errori di rete, due sessioni dello
stesso utente, rilascio e scadenza del lock. Evitare la perdita silenziosa di un
form non salvato.

## Parità degli adapter

Per ogni comportamento comune modificato:

- aggiornare entrambi gli adapter o dimostrare che uno non è coinvolto;
- confrontare risultati, ordinamento, visibilità, errori semantici,
  `rowVersion`, rollback e autorizzazione;
- aggiungere o aggiornare contract test condivisi;
- usare esclusivamente un database PostgreSQL dedicato con nome contenente
  `test` per prove distruttive;
- estendere l'E2E amministrativo quando cambia un comportamento visibile nel
  pannello;
- non considerare la sola suite SQLite prova sufficiente della parità.

## Criteri di completamento

Un intervento non è concluso con la sola compilazione. In proporzione al
rischio, verificare:

- `git diff --check`;
- typecheck e lint Core/Web;
- test unitari e di regressione interessati;
- contract test SQLite/PostgreSQL per la persistenza comune;
- build production Web per cambiamenti runtime o frontend;
- E2E della verticale o del pannello admin per cambiamenti osservabili;
- migrazioni su schema vuoto e percorso di upgrade quando cambia il database;
- documentazione normativa e operativa coinvolta.

Prima di dichiarare pronta una release candidata, `pnpm check`, integrazioni
PostgreSQL, parità adapter, E2E canonico e backup/restore devono essere verdi in
un ambiente isolato.

## Disciplina delle modifiche

- Preferire correzioni piccole e verificabili, senza refactoring estranei al
  risultato richiesto.
- Conservare compatibilità e dati esistenti salvo migrazione esplicita.
- Non indebolire controlli di sicurezza per uniformare gli adapter o
  semplificare i test.
- Non usare dati o credenziali operative nei test.
- Non modificare o eliminare cambiamenti locali dell'utente non pertinenti.
- Non applicare migrazioni distruttive al database operativo.
- Non creare commit, tag o push salvo richiesta esplicita dell'utente.

## Documentazione

Codice, migrazioni e test definiscono il comportamento osservato;
`ARCHITECTURE.md` e `docs/` descrivono il contratto normativo corrente;
`Specifiche/` conserva requisiti e decisioni storiche.

Quando il comportamento cambia, aggiornare nello stesso intervento i documenti
normativi interessati. Non riscrivere retroattivamente audit o specifiche
storiche: aggiungere una nota di stato e rimandare alla fonte corrente.
