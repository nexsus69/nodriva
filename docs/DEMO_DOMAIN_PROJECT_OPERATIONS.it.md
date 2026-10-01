# Nodriva: verticale canonica project operations

Nodriva è il nome del prodotto. Lo scenario project operations è la verticale
canonica per accettazione e regressione: dimostra la piattaforma generica senza
trasformare nodi, tipi, entità o relazioni in primitive specifiche di dominio.
Nomi dei pacchetti, identificativi del database e documenti storici conservano
i nomi esistenti finché non viene approvata una migrazione tecnica esplicita.

Il seed demo conserva il fixture degli ordini originale per compatibilità e
aggiunge lo scenario Nodriva rappresentativo:

```text
Organizzazione Acme Delivery
└── Divisione Platform
    └── Team Core
        ├── Progetto Control Center
        │   └── Milestone Foundation
        └── Progetto Experience
            └── Milestone Mobile
```

I tipi dinamici delle entità sono:

- `project-brief`: stato, proprietario, cliente e date;
- `task-record`: stato, priorità, assegnatario, scadenza e dipendenza;
- `project-document`: tipo documento, versione e stato di revisione.

Il campo `task-record.depends_on` è una relazione verso un altro
`task-record`; il fixture esercita quindi anche i metadati delle relazioni,
oltre alla gerarchia e alle tabelle di storage dinamico.

Lo scenario resta disponibile nelle installazioni che hanno già caricato il
fixture demo storico. Le nuove installazioni usano il bootstrap amministrativo
non distruttivo: i dati demo devono essere forniti esplicitamente da fixture di
sviluppo o E2E e non vengono mai creati all'avvio del servizio. Le istruzioni
storiche `RESET DEMO DATABASE` e `ALLOW_DESTRUCTIVE_SEED` sono obsolete; oggi
l'applicazione non espone quel flusso. `INITIALIZE SYSTEM` è un bootstrap
amministrativo autenticato, non un caricatore o reset dei dati demo.
Per un'installazione vuota seguire la [guida al primo accesso](FIRST_RUN.md);
per gli scenari automatici usare solo i fixture isolati descritti sotto.

Lo scenario browser del release gate è `pnpm e2e:canonical`. Prepara il proprio
schema e i propri dati project operations in profili SQLite e PostgreSQL
temporanei, quindi confronta l'esito osservabile comune. Non dipende dal
fixture demo storico e non tocca un database operativo.

I criteri di accettazione e le evidenze richieste per ogni passaggio sono
gestiti nella [`NODRIVA_ACCEPTANCE_CHECKLIST.md`](./NODRIVA_ACCEPTANCE_CHECKLIST.md).
