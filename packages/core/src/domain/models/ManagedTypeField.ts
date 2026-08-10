/**
 * Modello di un campo all'interno di un tipo gestito.
 * Mappato 1:1 su node_type_fields / entity_type_fields.
 * Classe dati sobria: nessuna logica di dominio.
 */
export class ManagedTypeField {
  constructor(
    readonly id: string,
    readonly typeDefinitionId: string,
    readonly fieldKey: string,
    readonly label: string,
    readonly columnName: string,
    readonly dataType: string,
    readonly isRequired: boolean,
    readonly isUnique: boolean,
    readonly isIndexed: boolean,
    readonly defaultValueText: string | null,
    readonly position: number,
    readonly isSystem: boolean,
    readonly createdAt: Date,
    readonly updatedAt: Date,
    readonly relationTargetDomain: 'node' | 'entity' | null = null,
    readonly relationTargetTypeKey: string | null = null,
    readonly enumMode: 'static' | 'managed' = 'static',
    readonly encryptionMode: 'inherit' | 'plaintext' | 'encrypted' = 'inherit'
  ) {}
}
