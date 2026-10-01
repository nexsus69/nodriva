# Operazioni di backup

I backup PostgreSQL sono pianificati dall'operatore e verificati con restore in
un ambiente isolato. Ogni copia deve avere timestamp, versione dello schema,
stato di cifratura e risultato della verifica.

Il profilo SQLite richiede la copia consistente del file e dei relativi
segreti/configurazioni. Non includere file storici ignorati o credenziali nei
commit; documentare sempre l'RPO/RTO e il proprietario del runbook.
