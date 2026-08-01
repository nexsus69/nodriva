/**
 * Modello di un tipo gestito dal layer amministrativo.
 * Mappato 1:1 su node_types / entity_types.
 * Classe dati sobria: nessuna logica di dominio.
 */
export class ManagedTypeDefinition {
  constructor(
    readonly id: string,
    readonly typeKey: string,
    readonly name: string,
    readonly description: string,
    readonly storageTable: string | null,
    readonly placementPolicyId: string | null,
    readonly currentSchemaVersion: number,
    readonly isActive: boolean,
    readonly isSystem: boolean,
    readonly rowVersion: number,
    readonly createdAt: Date,
    readonly updatedAt: Date,
    readonly deletedAt: Date | null
  ) {}
}
