import { SchemaInvalidationPort } from '../../application/ports/SchemaInvalidationPort.js';
import { SchemaRegistry } from '../../application/ports/SchemaRegistry.js';
import { TypeDomain } from '../../application/dto/TypeFieldDefinition.js';

/**
 * Adapter che delega l'invalidazione al SchemaRegistry unificato.
 */
export class SchemaInvalidationAdapter implements SchemaInvalidationPort {
  constructor(private readonly registry: SchemaRegistry) {}

  invalidate(domain: TypeDomain, typeKey: string): void {
    this.registry.invalidate(domain, typeKey);
  }
}
