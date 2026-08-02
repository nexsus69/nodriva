# Enum statici e gestiti

## Obiettivo

Il campo `enum` rappresenta un valore scelto da un catalogo di opzioni. Il valore tecnico viene salvato nell'istanza, mentre l'etichetta viene mostrata nell'interfaccia.

Esempio:

```text
value: published
label: Pubblicato
```

## Modalità

Ogni campo enum può essere:

- `static`: le opzioni sono definite nella configurazione dello schema; il frontend può solo selezionarle;
- `managed`: gli utenti autorizzati possono aggiungere nuove opzioni dal form di creazione dell'istanza.

La modalità si configura quando il campo viene creato dall'amministrazione dei tipi.

## Persistenza

Le opzioni gestite sono persistite in:

- `node_type_field_enum_options`;
- `entity_type_field_enum_options`.

Ogni opzione contiene valore tecnico, etichetta, posizione e stato attivo. Il vincolo univoco è `(field_id, value)`.

I vecchi vincoli `enum` con valori separati da virgola restano supportati come fallback compatibile:

```text
draft,published,archived
```

Le nuove opzioni usano invece le tabelle dedicate.

## Flusso frontend

1. Il frontend legge la definizione del tipo dal backend.
2. Il campo enum viene visualizzato come `select`.
3. Per gli enum `managed` viene mostrata l'azione `Aggiungi opzione`.
4. Il backend verifica autenticazione, permessi, campo enum e unicità del valore.
5. Dopo il commit l'opzione viene resa disponibile nel catalogo e lo schema viene invalidato.

La cache non è autorevole: la validazione finale del valore viene eseguita dal backend contro la definizione aggiornata.

## Regole di sicurezza

- le opzioni devono avere un valore tecnico valido e univoco;
- un enum statico non può essere esteso dal frontend;
- le opzioni non vengono cancellate fisicamente durante l'uso ordinario: vanno disattivate;
- le istanze esistenti devono continuare a essere leggibili anche se un'opzione viene disattivata;
- ogni modifica deve passare dal service applicativo e dai relativi controlli autorizzativi.

## Migrazione

La struttura è introdotta da:

```text
packages/core/src/infrastructure/schema/006_managed_enum_options.sql
```
