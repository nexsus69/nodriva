import { z } from 'zod';

export interface EntitySchemaCompiler {
  compile(typeKey: string): Promise<z.ZodObject<any>>;
}
