import type { z } from 'zod';

export interface EntitySchemaRegistry {
  getSchema(typeKey: string): Promise<z.ZodObject<z.ZodRawShape> | null>;
}
