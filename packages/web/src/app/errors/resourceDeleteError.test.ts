/** Covers the presentation boundary for structured RESOURCE_DELETE_RESTRICTED errors. */
import { describe, expect, it } from 'vitest';
import { formatResourceDeleteError } from './resourceDeleteError';

describe('formatResourceDeleteError', () => {
  it('keeps the localized message separate from structured referencers', () => {
    expect(formatResourceDeleteError({
      code: 'RESOURCE_DELETE_RESTRICTED',
      message: 'Impossibile eliminare la risorsa perché possiede riferimenti attivi.',
      totalReferencerCount: 2,
      referencers: [{ type: 'Task', id: 'task-1', name: 'Task esterno' }],
    })).toBe('Impossibile eliminare la risorsa perché possiede riferimenti attivi.');
  });

  it('does not disclose identifiers when no referencer is visible', () => {
    expect(formatResourceDeleteError({
      code: 'RESOURCE_DELETE_RESTRICTED',
      message: 'Impossibile eliminare la risorsa perché possiede riferimenti attivi.',
      totalReferencerCount: 1,
      referencers: [],
    })).toBe('Impossibile eliminare la risorsa perché possiede riferimenti attivi.');
  });

  it('keeps unrelated errors unchanged', () => {
    expect(formatResourceDeleteError({ code: 'LOCK_CONFLICT', message: 'La risorsa è bloccata.' })).toBe('La risorsa è bloccata.');
  });
});
