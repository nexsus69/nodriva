/** Verifies the shared password policy contract used by validation and UI. */
import { describe, expect, it } from 'vitest';
import {
  getUnmetUserPasswordRequirements,
  isUserPasswordValid,
} from './UserPasswordPolicy.js';

describe('UserPasswordPolicy', () => {
  it('requires a symbol in addition to length, letters, and a number', () => {
    expect(getUnmetUserPasswordRequirements('Password123456')).toContain('special');
    expect(isUserPasswordValid('Password123456')).toBe(false);
  });

  it('accepts a password satisfying every requirement', () => {
    expect(getUnmetUserPasswordRequirements('Password123456!')).toEqual([]);
    expect(isUserPasswordValid('Password123456!')).toBe(true);
  });
});
