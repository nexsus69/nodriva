/**
 * Tipi di dominio supportati dal registry unificato.
 * Determina da quale famiglia di tabelle leggere le definizioni.
 */
export type TypeDomain = 'node' | 'entity';

/**
 * Tipi di vincolo supportati, allineati al tipo SQL `constraint_type_enum`.
 */
export type ConstraintType =
  | 'min'
  | 'max'
  | 'min_length'
  | 'max_length'
  | 'regex'
  | 'enum'
  | 'precision'
  | 'scale';

/**
 * Singolo vincolo su un campo di tipo dinamico.
 */
export class TypeFieldConstraint {
  constructor(
    readonly constraintType: ConstraintType,
    readonly value: string
  ) {}
}

/**
 * Definizione di un campo all'interno di un tipo dinamico.
 * Indipendente dal dominio (node o entity).
 */
export class TypeFieldDefinition {
  constructor(
    readonly fieldKey: string,
    readonly dataType: string,
    readonly isRequired: boolean,
    readonly constraints: readonly TypeFieldConstraint[]
  ) {}
}

/**
 * Definizione completa di un tipo dinamico: metadati + campi.
 * Rappresenta un NodeType o un EntityType letto dal database,
 * con tutti i campi e vincoli necessari alla compilazione dello schema.
 */
export class TypeDefinition {
  constructor(
    readonly id: string,
    readonly domain: TypeDomain,
    readonly typeKey: string,
    readonly name: string,
    readonly description: string,
    readonly currentSchemaVersion: number,
    readonly fields: readonly TypeFieldDefinition[]
  ) {}
}
