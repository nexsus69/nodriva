import { TypeDomain } from '../dto/TypeFieldDefinition.js';

/**
 * Porta per l'invalidazione della cache del registry degli schemi.
 * Separata da SchemaRegistry per interface segregation:
 * il service admin non ha bisogno di getSchema o clear.
 */
export interface SchemaInvalidationPort {
  invalidate(domain: TypeDomain, typeKey: string): void;
}
