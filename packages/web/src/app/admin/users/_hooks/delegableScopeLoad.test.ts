import { describe, expect, it } from 'vitest';
import { classifyDelegableScopeResult } from './delegableScopeLoad';

const allowScope = { id: 'allow', assignmentEffect: 'allow' } as never;
const denyScope = { id: 'deny', assignmentEffect: 'deny' } as never;

describe('classifyDelegableScopeResult', () => {
  it('keeps only scopes that can be delegated to the new user', () => {
    expect(classifyDelegableScopeResult({ success: true, data: [allowScope, denyScope] })).toEqual({
      state: 'ready',
      scopes: [allowScope],
      error: null,
    });
  });

  it('treats an explicit authorization denial as a restricted normal-user flow', () => {
    expect(classifyDelegableScopeResult({
      success: false,
      error: { code: 'ACCESS_FORBIDDEN', message: 'Accesso negato.' },
    })).toEqual({ state: 'restricted', scopes: [], error: null });
  });

  it('blocks the flow when scope loading fails unexpectedly', () => {
    const error = { code: 'INTERNAL_ERROR', message: 'Servizio non disponibile.' } as const;
    expect(classifyDelegableScopeResult({ success: false, error })).toEqual({
      state: 'failed',
      scopes: [],
      error,
    });
  });
});
