# Contratto dello stato workspace Admin

[Italiano](ADMIN_WORKSPACE_STATE.it.md) | [English](ADMIN_WORKSPACE_STATE.md)

Ogni modulo Admin gestisce due classi di stato:

- dati server e cache, autorevoli nell'application cache;
- stato workspace, che ricostruisce il contesto amministrativo dopo un reload.

Tab, risorse selezionate, drawer/modal aperti, bozze, filtri, ordinamento e passi
dei wizard sono stato workspace. Non devono essere conservati soltanto in
`useState` locale al componente. I nuovi moduli devono usare
`useAdminModuleState(moduleKey, defaults)`, così lo stato è nominato, persistito
nello store workspace Admin e ripristinato in modo coerente.

Lo stato locale è riservato ai dettagli di rendering effimeri che non cambiano
la posizione dell'utente o il lavoro non salvato, come fase di un'animazione o
hover temporaneo.
