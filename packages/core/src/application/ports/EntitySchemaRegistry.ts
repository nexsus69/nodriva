import { z } from 'zod';

export interface EntitySchemaRegistry {
  getSchema(typeKey: string): Promise<z.ZodObject<any> | null>;
}
