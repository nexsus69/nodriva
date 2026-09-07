/** Verifies that server action errors retain only the safe structured deletion details. */
import { describe, expect, it } from 'vitest';
import { AppError } from '@dashboard/core';
import { mapAppErrorToApiErrorResponse } from './errorMapping';

describe('mapAppErrorToApiErrorResponse', () => {
  it('preserves only structured visible referencers for deletion restrictions', () => {
    const response = mapAppErrorToApiErrorResponse(new AppError(
      'RESOURCE_DELETE_RESTRICTED',
      'internal message',
      {
        totalReferencerCount: 2,
        referencers: [
          { domain: 'entity', parentNodeId: 'node-1', type: 'Task', id: 'task-1', name: 'External task' },
          { type: 'Task', id: 42, name: 'invalid id' },
          'invalid',
        ],
      },
    ));

    expect(response).toEqual({
      code: 'RESOURCE_DELETE_RESTRICTED',
      message: 'Impossibile eliminare la risorsa perché possiede riferimenti attivi.',
      totalReferencerCount: 2,
      referencers: [{ domain: 'entity', type: 'Task', id: 'task-1', name: 'External task', href: '/nodes/node-1/entities/task-1' }],
    });
  });
});
