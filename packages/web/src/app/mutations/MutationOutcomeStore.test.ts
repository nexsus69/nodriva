/** Verifies lifecycle of the shared success outcome across UI surface changes. */
import { afterEach, describe, expect, it } from 'vitest';
import { publishMutationSuccess, useMutationOutcomeStore } from './MutationOutcomeStore';

describe('MutationOutcomeStore', () => {
  afterEach(() => useMutationOutcomeStore.getState().dismissSuccess());

  it('replaces the prior outcome and keeps the latest success until it is dismissed', () => {
    publishMutationSuccess('mutation.created');
    const first = useMutationOutcomeStore.getState().success;
    publishMutationSuccess('mutation.updated');
    const second = useMutationOutcomeStore.getState().success;

    expect(first?.messageKey).toBe('mutation.created');
    expect(second?.messageKey).toBe('mutation.updated');
    expect(second?.id).toBeGreaterThan(first?.id ?? 0);
    useMutationOutcomeStore.getState().dismissSuccess();
    expect(useMutationOutcomeStore.getState().success).toBeNull();
  });
});
