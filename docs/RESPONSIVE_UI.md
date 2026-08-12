# Responsive UI

Il frontend supporta le route operative e amministrative a 320, 375, 768 e
desktop. Le tabelle amministrative adottano una rappresentazione a card sui
viewport stretti; form, toolbar, paginazione, dialog e identificativi lunghi
si adattano senza introdurre overflow orizzontale della pagina.

## Breadcrumb

Il breadcrumb è centralizzato nel componente `ResponsiveBreadcrumb` e viene
usato sia dal pannello amministrativo sia dalla navigazione gerarchica dei
nodi.

- su desktop mostra tutti i livelli della gerarchia;
- il primo livello è rappresentato da un’icona Home SVG, con etichetta
  accessibile e tooltip, senza testo aggiuntivo nella resa visiva;
- su mobile mostra Home, i livelli più vicini e il livello corrente;
- i livelli intermedi vengono sostituiti da `…` quando il percorso è lungo;
- il livello corrente resta sempre visibile e viene troncato solo visivamente,
  mantenendo il nome completo nel tooltip;
- i link, i separatori e gli indicatori di lock sono non comprimibili nei punti
  necessari e non possono sovrapporsi.

La verifica browser copre le larghezze 320, 375, 768 e 1280 pixel, controllando
overflow, sovrapposizioni, raggiungibilità della Home e presenza del livello
corrente.
