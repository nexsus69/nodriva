/** Verifies lifecycle of the shared success outcome across UI surface changes. */
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  MUTATION_SUCCESS_AUTO_DISMISS_MS,
  publishMutationSuccess,
  useMutationOutcomeStore,
} from './MutationOutcomeStore';

describe('MutationOutcomeStore', () => {
  afterEach(() => {
    useMutationOutcomeStore.getState().dismissSuccess();
    vi.useRealTimers();
  });

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

  it('automatically dismisses the latest outcome after five seconds', () => {
    vi.useFakeTimers();
    publishMutationSuccess('mutation.created');
    vi.advanceTimersByTime(MUTATION_SUCCESS_AUTO_DISMISS_MS - 1);
    publishMutationSuccess('mutation.updated');
    vi.advanceTimersByTime(1);

    expect(useMutationOutcomeStore.getState().success?.messageKey).toBe('mutation.updated');
    vi.advanceTimersByTime(MUTATION_SUCCESS_AUTO_DISMISS_MS - 1);

    expect(useMutationOutcomeStore.getState().success).toBeNull();
  });
});
