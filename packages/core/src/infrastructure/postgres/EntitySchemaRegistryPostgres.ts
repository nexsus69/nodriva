import { z } from 'zod';
import { EntitySchemaRegistry } from '../../application/ports/EntitySchemaRegistry.js';
import { EntitySchemaCompiler } from '../../application/ports/EntitySchemaCompiler.js';

export class EntitySchemaRegistryPostgres implements EntitySchemaRegistry {
  private readonly cache = new Map<string, z.ZodObject<any>>();

  constructor(private readonly compiler: EntitySchemaCompiler) {}

  async getSchema(typeKey: string): Promise<z.ZodObject<any> | null> {
    const cached = this.cache.get(typeKey);
    if (cached) {
      return cached;
    }

    try {
      const compiled = await this.compiler.compile(typeKey);
      this.cache.set(typeKey, compiled);
      return compiled;
    } catch (error) {
      return null;
    }
  }

  invalidate(typeKey: string): void {
    this.cache.delete(typeKey);
  }

  clear(): void {
    this.cache.clear();
  }
}
