import { TypeDomain } from '../dto/TypeFieldDefinition.js';
import { TypeListItemDto, TypeDetailDto } from '../dto/AdminContractDtos.js';
import { ManagedTypeDefinition } from '../../domain/models/ManagedTypeDefinition.js';
import { ManagedTypeField } from '../../domain/models/ManagedTypeField.js';
import { ManagedTypeFieldConstraint } from '../../domain/models/ManagedTypeFieldConstraint.js';
import { ManagedEnumOption } from '../../domain/models/ManagedEnumOption.js';

/**
 * Repository write/read side unificato per tipi, campi e vincoli.
 * Gestisce entrambi i domini (node/entity) tramite il parametro TypeDomain.
 */
export interface TypeDefinitionAdminRepository {
  // --- Type ---
  findTypeById(domain: TypeDomain, id: string): Promise<ManagedTypeDefinition | null>;
  findTypeByKey(domain: TypeDomain, typeKey: string): Promise<ManagedTypeDefinition | null>;
  listTypes(domain: TypeDomain): Promise<TypeListItemDto[]>;
  getTypeDetail(domain: TypeDomain, typeKey: string): Promise<TypeDetailDto | null>;
  createType(domain: TypeDomain, typeDef: ManagedTypeDefinition): Promise<void>;
  updateType(domain: TypeDomain, typeDef: ManagedTypeDefinition): Promise<void>;

  // --- Field ---
  findFieldById(domain: TypeDomain, fieldId: string): Promise<ManagedTypeField | null>;
  createField(domain: TypeDomain, field: ManagedTypeField): Promise<void>;
  updateField(domain: TypeDomain, field: ManagedTypeField): Promise<void>;
  deleteField(domain: TypeDomain, fieldId: string): Promise<void>;
  existsFieldByKey(domain: TypeDomain, typeId: string, fieldKey: string): Promise<boolean>;
  existsFieldByColumnName(domain: TypeDomain, typeId: string, columnName: string): Promise<boolean>;

  // --- Constraint ---
  findConstraintById(domain: TypeDomain, constraintId: string): Promise<ManagedTypeFieldConstraint | null>;
  createConstraint(domain: TypeDomain, constraint: ManagedTypeFieldConstraint): Promise<void>;
  updateConstraint(domain: TypeDomain, constraint: ManagedTypeFieldConstraint): Promise<void>;
  deleteConstraint(domain: TypeDomain, constraintId: string): Promise<void>;

  // --- Integrity ---
  hasInstancesOfType(domain: TypeDomain, typeId: string): Promise<boolean>;
  hasValuesInField(domain: TypeDomain, typeId: string, fieldKey: string, columnName: string): Promise<boolean>;
  countIncomingRelations(domain: TypeDomain, typeKey: string): Promise<number>;
  existsEnumOption(domain: TypeDomain, fieldId: string, value: string): Promise<boolean>;
  createEnumOption(domain: TypeDomain, option: ManagedEnumOption): Promise<void>;
}
