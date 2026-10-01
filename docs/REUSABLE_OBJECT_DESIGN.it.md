# Regola per oggetti riutilizzabili

Ogni nuova funzione deve essere progettata come oggetto, definizione, contratto
o controller riutilizzabile prima di essere implementata per una sola schermata.

Individuare il comportamento comune, definirne l'owner e le invarianti,
lasciare la configurazione specifica in un adapter stretto e testare l'oggetto
prima di usarlo nei moduli. Non duplicare logica di modali, form, tabelle,
cache, navigazione o bozze tra schermate. Le transizioni, gli errori, la
validazione e il ciclo di vita condivisi appartengono all'astrazione comune;
non aggiungere livelli generici senza una duplicazione reale o un contratto da
proteggere.
