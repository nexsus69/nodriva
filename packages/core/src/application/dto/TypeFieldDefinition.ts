import type { ResourceContainmentRule, ResourceRelationDefinition } from './ResourceRelations.js';
import type { ResourceFieldDefinition, ResourceTypeReference } from './ResourceSchema.js';

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

export interface EnumOptionDefinition {
  value: string;
  label: string;
  isActive: boolean;
  position: number;
}

/**
 * Definizione di un campo all'interno di un tipo dinamico.
 * Indipendente dal dominio (node o entity).
 */
export class TypeFieldDefinition implements ResourceFieldDefinition {
  constructor(
    readonly fieldKey: string,
    readonly dataType: string,
    readonly isRequired: boolean,
    readonly constraints: readonly TypeFieldConstraint[],
    readonly relationTargetDomain: TypeDomain | null = null,
    readonly relationTargetTypeKey: string | null = null,
    readonly enumOptions: readonly EnumOptionDefinition[] = [],
    readonly enumMode: 'static' | 'managed' = 'static',
    readonly id: string | null = null,
    readonly label: string = fieldKey,
    readonly encryptionMode: 'inherit' | 'plaintext' | 'encrypted' = 'inherit'
  ) {}

  get relationTarget(): ResourceTypeReference | null {
    return this.relationTargetDomain && this.relationTargetTypeKey
      ? { resourceType: this.relationTargetDomain, typeKey: this.relationTargetTypeKey }
      : null;
  }
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
    readonly fields: readonly TypeFieldDefinition[],
    readonly containmentRules: readonly ResourceContainmentRule[] = []
  ) {}

  get resourceTypeReference(): ResourceTypeReference {
    return { resourceType: this.domain, typeKey: this.typeKey };
  }

  get relationDefinitions(): readonly ResourceRelationDefinition[] {
    return this.fields.flatMap((field) =>
      field.relationTarget
        ? [{
            source: this.resourceTypeReference,
            target: field.relationTarget,
            kind: 'reference' as const,
            cardinality: 'many-to-one' as const,
            fieldKey: field.fieldKey,
          }]
        : []
    );
  }
}
