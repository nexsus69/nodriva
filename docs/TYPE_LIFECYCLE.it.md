# Ciclo di vita dei tipi

I tipi definiscono campi, enum e relazioni per le entità. La modifica è
versionata e validata; la disattivazione impedisce nuove assegnazioni senza
alterare i dati storici leggibili.

Ogni transizione aggiorna audit e catalogo in modo atomico. Il backend verifica
permessi, scope e compatibilità prima di pubblicare il nuovo schema semantico.
