# Lifecycle dei tipi dinamici

`node_types` ed `entity_types` hanno due stati distinti, applicati da tutti
gli adapter PostgreSQL e SQLite.

| Campo | Stato | Contratto |
| --- | --- | --- |
| `is_active` | `false` | Il tipo esiste ed è amministrabile, ma non è operativo. Non compare nei repository runtime e il suo schema non viene risolto. Può essere riattivato. |
| `deleted_at` | non `NULL` | Il tipo è un tombstone: non compare né ai flussi runtime né alle liste/dettagli admin normali. Richiederebbe un flusso esplicito di restore per tornare utilizzabile. |

## Flussi

- Il tipo viene creato attivo (`is_active = true`, `deleted_at = NULL`).
- `disableType` è reversibile: imposta `is_active = false`, incrementa la row
  version e invalida il registry schema. È rifiutata se il tipo ha istanze
  attive.
- `enableType` ripristina `is_active = true` e invalida il registry schema.
- Il servizio admin usa il repository amministrativo, che include i tipi
  inattivi per permetterne l'ispezione e la riattivazione. Esclude sempre i
  tombstone.
- Repository runtime e `TypeDefinitionReader` richiedono sempre sia
  `is_active = true` sia `deleted_at IS NULL`.

Non esiste attualmente un comando applicativo che imposti `deleted_at` sui
tipi. Il campo resta riservato a una futura cancellazione logica con restore
esplicito; non va usato come sinonimo di disabilitazione.
