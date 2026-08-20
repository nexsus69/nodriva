import type { ApiErrorResponse, ScopeAssignmentDto } from '@dashboard/core';

export type DelegableScopeLoadState = 'idle' | 'loading' | 'ready' | 'restricted' | 'failed';

type ScopeActionResult = {
  success: boolean;
  data?: ScopeAssignmentDto[];
  error?: ApiErrorResponse;
};

export function classifyDelegableScopeResult(result: ScopeActionResult): {
  state: Exclude<DelegableScopeLoadState, 'idle' | 'loading'>;
  scopes: ScopeAssignmentDto[];
  error: ApiErrorResponse | null;
} {
  if (result.success && result.data) {
    return {
      state: 'ready',
      scopes: result.data.filter((scope) => scope.assignmentEffect === 'allow'),
      error: null,
    };
  }
  if (result.error?.code === 'ACCESS_FORBIDDEN') {
    return { state: 'restricted', scopes: [], error: null };
  }
  return {
    state: 'failed',
    scopes: [],
    error: result.error ?? {
      code: 'INTERNAL_ERROR',
      message: 'Impossibile verificare gli ambiti delegabili.',
    },
  };
}
