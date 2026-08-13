import type { z } from 'zod';
import type { TypeDomain } from '../../application/dto/TypeFieldDefinition.js';
import type { SchemaRegistry } from '../../application/ports/SchemaRegistry.js';
import type { TypeDefinitionReader } from '../../application/ports/TypeDefinitionReader.js';
import type { FieldSchemaCompiler } from './FieldSchemaCompiler.js';

/**
 * Registry con cache in memoria che compone TypeDefinitionReader + FieldSchemaCompiler.
 *
 * Flusso:
 * 1. Controlla la cache per `${domain}:${typeKey}`.
 * 2. Se miss: legge la definizione completa dal reader.
 * 3. Compila i campi con il compiler (sincrono).
 * 4. Cacheizza e restituisce.
 *
 * L'invalidazione è manuale (invalidate / clear).
 */
export class CachingSchemaRegistry implements SchemaRegistry {
  private readonly cache = new Map<string, z.ZodObject<z.ZodRawShape>>();

  constructor(
    private readonly reader: TypeDefinitionReader,
    private readonly compiler: FieldSchemaCompiler
  ) {}

  async getSchema(domain: TypeDomain, typeKey: string): Promise<z.ZodObject<z.ZodRawShape> | null> {
    const cacheKey = this.buildCacheKey(domain, typeKey);

    const cached = this.cache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const definition = await this.reader.readDefinition(domain, typeKey);
    if (!definition) {
      return null;
    }

    // Il compiler è sincrono e lancia UnsupportedFieldDataTypeError se un campo
    // ha un dataType non supportato — l'errore viene propagato al chiamante.
    const schema = this.compiler.compile(definition.fields, definition.typeKey);
    this.cache.set(cacheKey, schema);

    return schema;
  }

  invalidate(domain: TypeDomain, typeKey: string): void {
    const cacheKey = this.buildCacheKey(domain, typeKey);
    this.cache.delete(cacheKey);
  }

  clear(): void {
    this.cache.clear();
  }

  private buildCacheKey(domain: TypeDomain, typeKey: string): string {
    return `${domain}:${typeKey}`;
  }
}
