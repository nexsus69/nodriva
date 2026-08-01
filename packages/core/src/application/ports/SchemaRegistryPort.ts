import { z } from 'zod';

export interface SchemaRegistryPort {
  getNodeTypeSchema(nodeTypeKey: string): Promise<z.ZodSchema | null>;
  getEntityTypeSchema(entityTypeKey: string): Promise<z.ZodSchema | null>;
}
