# Regola per oggetti riutilizzabili

[Italiano](REUSABLE_OBJECT_DESIGN.it.md) | [English](REUSABLE_OBJECT_DESIGN.md)

Ogni nuova funzione deve essere progettata come oggetto, definizione, contratto
o controller riutilizzabile prima di essere implementata per una sola schermata
o caso d'uso.

## Approccio obbligatorio

1. Individuare il comportamento comune tra casi d'uso correnti e futuri.
2. Definire l'oggetto o contratto che possiede comportamento e invarianti.
3. Lasciare il codice specifico di dominio in un oggetto configurazione o
   adapter stretto.
4. Rendere parte dell'oggetto riutilizzabile persistenza, transizioni,
   validazione, errori e lifecycle quando sono responsabilità condivise.
5. Aggiungere un test mirato prima di usarlo in un modulo.

## Approccio vietato

- non implementare comportamento riutilizzabile direttamente in una pagina;
- non duplicare logica di modali, form, tabelle, cache, navigazione o bozze;
- non aggiungere un parametro che nasconde un solo ramo specifico mentre la
  logica resta incorporata nel consumer;
- non chiamare riutilizzabile una feature il cui lifecycle o persistenza è
  ancora controllato da state locale del componente.

## Domande di revisione

Prima di dichiarare completa una feature verificare:

- un altro modulo può istanziarla tramite definizione o adapter?
- l'oggetto possiede transizioni di stato e cleanup?
- reload, errore, pending, conferma e bozze seguono regole coerenti?
- il consumer è soprattutto configurazione e non implementazione copiata?
- il contratto riutilizzabile è documentato in italiano e inglese e testato?

Il pannello Admin applica la regola tramite `AdminModule`,
`AdminResourceDefinition`, `AdminSurfaceDefinition`, oggetti form/table
condivisi e adapter per modulo. `AdminSurfaceHost` possiede layout comune di
modal, drawer e superficie inline; i moduli forniscono configurazione e
contenuto, non logica di layout.

La selezione nodi segue la stessa regola. Un form dichiara un campo `nodeTree`
con catalogo autorizzato, etichette localizzate, modalità di interazione e
valore form. `FormRenderer` possiede rendering gerarchico, selezione diretta,
drag-and-drop, validazione e integrazione bozze. I moduli Admin non devono
montare un picker separato né sincronizzare manualmente un ID nodo nascosto.

## Invarianti del pannello Admin

Il pannello ha un solo percorso per ogni comportamento condiviso:

- `AdminModuleRegistry` è il catalogo canonico di navigazione e route; la
  navigazione visibile deriva da permessi verificati dal backend;
- `AdminWorkspaceStore` persiste navigazione modulo, filtri, paginazione,
  risorse selezionate, modalità/soggetto superficie e bozze;
- `AdminResourceDefinition` dichiara permessi operativi e
  `AdminResourceController` possiede loading, pending, error e refresh della
  mutation; l'autorizzazione backend resta autorevole;
- `AdminCollectionScreen`, `AdminTable` e `AdminPagination` rendono ogni
  collection ordinaria. Una tabella specializzata è ammessa solo per una
  interazione distinta, come riordinare campi;
- `AdminSurfaceHost` è l'unico host modal/drawer e il confirmation service
  Application è l'unico percorso di conferma;
- i form usano `FormDefinition` e `FormRenderer`; tipo campo, required e
  validazione non acquisiscono interpretazioni per modulo;
- `ResourceFormRenderer`, `ResourceFormDefinition` e `ResourceFormDraft`
  compongono campi identità stabili e metadata dinamici e riportano il valore
  flat nei segmenti della bozza canonica. Schermate nodo/entità non ricreano
  select native, mapping allegati o form annidati;
- `CustomSelect` è l'unica implementazione di select: tipi statici, filtri e
  relazioni caricate async condividono contratto tastiera/accessibilità;
- `ConfirmDialogStore` e `ConfirmDialogHost` sono l'unico percorso di conferma
  in-app. L'avviso browser `beforeunload` è l'unica eccezione perché il browser
  non consente una superficie custom durante chiusura/reload;
- ogni testo visibile Admin è definito per entrambe le lingue supportate.

I test statici impongono percorsi unici per conferme, tabelle, superfici e
traduzioni. Un nuovo modulo estende questi contratti e non aggiunge una seconda
mappa route o implementazione locale.

## Design system dell'esperienza Admin

L'esperienza Admin è una preoccupazione Presentation nei bounded context
Administration e Frontend Read Model. Può dipendere da React, moduli e
definizioni risorsa, messaggi localizzati, action applicative e cache frontend
normalizzata; non da SQL, adapter di persistenza o comportamento DB-specifico.

Componenti e token riutilizzabili possiedono il comportamento visivo:

- `AdminIcon` vocabolario icone e SVG accessibile;
- `AdminPageHeader` gerarchia titoli, breadcrumb, descrizione e azioni primarie;
- `AdminToolbar` ricerca, filtri, metadata risultati e refresh;
- `AdminTable` navigazione righe, righe stabili, menu azioni, geometria loading,
  empty state e densità;
- `AdminSurfaceHost` geometria modal/drawer, focus, backdrop e azioni sticky;
- `FormDefinition` e `FormRenderer` raggruppamento form e layout responsive;
- feedback, badge, pulsanti e skeleton usano token semantici Admin.

I moduli configurano questi oggetti. Non ricreano localmente header, toolbar,
posizionamento azioni, placeholder loading o chrome delle superfici.

## Amministrazione delle risorse operative

L'amministrazione di nodi ed entità appartiene ai bounded context Hierarchy ed
Entity ed è esposta dal layer Presentation Admin. I moduli leggono tramite
action applicative autorizzate e cache normalizzata. Le mutation usano
`NodeApplicationService` e `EntityApplicationService`: autorizzazione,
validazione, lock, `rowVersion`, audit, transazioni e realtime restano del
backend.

I moduli operano fuori dalle transazioni database; le Server Action invocano i
servizi esistenti, che definiscono transazione e confini post-commit. Non serve
un nuovo port di persistenza e non si devono caricare record non filtrati da un
adapter. Le liste sono proiezioni delle radici e subtree leggibili dall'attore,
quindi un admin locale vede lo stesso perimetro operativo del workspace.

I cataloghi amministrativi conservano finestre query limitate su record summary
normalizzati. Ogni catalogo possiede la propria policy d'impatto: un notice
locale o realtime può patchare un record conservato solo se il summary
autorizzato preserva membership di ricerca e tupla di ordinamento; altrimenti
si invalida solo la famiglia di query coinvolta. La cache non calcola
autorizzazione né sostituisce la lettura backend quando la continuità è incerta.
