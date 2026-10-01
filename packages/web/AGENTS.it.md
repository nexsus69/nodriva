<!-- BEGIN:nextjs-agent-rules -->

# Questa non è la versione abituale di Next.js

Questa versione introduce modifiche incompatibili: API, convenzioni e struttura
dei file possono differire dai dati di addestramento. Prima di modificare il
codice, leggere la guida pertinente in `node_modules/next/dist/docs/`, risolta
rispetto a questa directory; nei monorepo il pacchetto `next` potrebbe non
essere visibile dalla root. Rispettare gli avvisi di deprecazione.

Questo blocco viene scritto e reinserito da `next dev`; verificare
`node_modules/next/dist/server/lib/generate-agent-files.js`. Rimuoverlo da un
diff ricrea soltanto la modifica non committata; mantenerlo nel commit lascia
pulito il worktree.

<!-- END:nextjs-agent-rules -->
