import { TypeDefinition, TypeDomain } from '../dto/TypeFieldDefinition.js';

/**
 * Porta per la lettura delle definizioni complete dei tipi dinamici dal database.
 * Restituisce metadati del tipo + campi + vincoli, indipendentemente dal dominio.
 */
export interface TypeDefinitionReader {
  /**
   * Legge la definizione completa di un tipo per dominio e typeKey.
   * @returns La definizione completa, oppure `null` se il tipo non esiste o è stato eliminato.
   */
  readDefinition(domain: TypeDomain, typeKey: string): Promise<TypeDefinition | null>;
}
