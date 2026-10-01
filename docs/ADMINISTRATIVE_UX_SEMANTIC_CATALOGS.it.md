# Cataloghi semantici per l'UX amministrativa

[Italiano](ADMINISTRATIVE_UX_SEMANTIC_CATALOGS.it.md) | [English](ADMINISTRATIVE_UX_SEMANTIC_CATALOGS.md)

Le interfacce amministrative traducono i contratti tecnici stabili in attività
comprensibili. Non devono chiedere di digitare un identificatore interno solo
perché è quello persistito dall'API.

Ogni concetto distingue valore umano (nome localizzato, descrizione e contesto)
e valore tecnico (chiave stabile inviata al backend). La UI mostra il valore
umano; la chiave resta secondaria, copiabile e valida anche per record storici.

Quando i valori possibili sono finiti, il server espone un catalogo autorizzato
e il Web usa select ricercabile, picker o checklist. Il testo libero è ammesso
solo per valori realmente aperti, come nomi, descrizioni, ricerca o espressioni
avanzate documentate.

I form raccolgono prima nome e descrizione, propongono una chiave normalizzata,
spiegano la grammatica e consentono override solo in modalità avanzata. Il
backend ricontrolla sempre chiave, permessi, scope e validazione; la cache non
concede autorizzazione.

Configurazioni complesse usano progressive disclosure, conservano bozze, filtri,
selezioni e passo wizard nello workspace e distinguono versioni pubblicate da
bozze. Ogni conversione deve testare mapping etichetta→valore, vuoto, loading,
errore, legacy, autorizzazione e validazione backend, con E2E quando la schermata
è visibile all'utente.
