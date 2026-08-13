import type { ConstraintType } from '../../application/dto/TypeFieldDefinition.js';

/**
 * Modello di un vincolo su un campo di tipo.
 * Mappato 1:1 su node_type_field_constraints / entity_type_field_constraints.
 * Classe dati sobria: nessuna logica di dominio.
 */
export class ManagedTypeFieldConstraint {
  constructor(
    readonly id: string,
    readonly fieldId: string,
    readonly constraintType: ConstraintType,
    readonly constraintValueText: string,
    readonly createdAt: Date
  ) {}
}
