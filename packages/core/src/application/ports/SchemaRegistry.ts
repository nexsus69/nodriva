import type { z } from 'zod';
import type { TypeDomain } from '../dto/TypeFieldDefinition.js';

/**
 * Porta unificata per il registry degli schemi Zod compilati a runtime.
 * Punto di ingresso per i service layer.
 */
export interface SchemaRegistry {
  /**
   * Restituisce lo schema Zod compilato per il tipo specificato.
   * Usa la cache interna se disponibile, altrimenti legge e compila.
   * @returns Lo schema Zod, oppure `null` se il tipo non esiste.
   * @throws UnsupportedFieldDataTypeError se un campo ha un dataType non supportato.
   * @throws SchemaCompilationError per errori generici di compilazione.
   */
  getSchema(domain: TypeDomain, typeKey: string): Promise<z.ZodObject<z.ZodRawShape> | null>;

  /**
   * Invalida la cache per un tipo specifico.
   * La prossima chiamata a getSchema rileggerà dal database e ricompilerà.
   */
  invalidate(domain: TypeDomain, typeKey: string): void;

  /**
   * Invalida tutta la cache.
   */
  clear(): void;
}
