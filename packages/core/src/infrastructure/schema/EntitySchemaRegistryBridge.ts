import { z } from 'zod';
import { EntitySchemaRegistry } from '../../application/ports/EntitySchemaRegistry.js';
import { SchemaRegistry } from '../../application/ports/SchemaRegistry.js';

/**
 * Bridge adapter che implementa la porta EntitySchemaRegistry esistente
 * delegando al SchemaRegistry unificato con domain = 'entity'.
 *
 * Scopo: mantenere compatibilità con EntityApplicationService e i suoi test
 * senza modificare il service layer.
 */
export class EntitySchemaRegistryBridge implements EntitySchemaRegistry {
  constructor(private readonly registry: SchemaRegistry) {}

  async getSchema(typeKey: string): Promise<z.ZodObject<z.ZodRawShape> | null> {
    return await this.registry.getSchema('entity', typeKey);
  }
}
