import { describe, expect, it } from 'vitest';
import { validateLockResource } from './lockResourceValidation';

describe('lock resource validation', () => {
  it('accepts deterministic PostgreSQL UUIDs used by seed nodes', () => {
    expect(
      validateLockResource(
        'node',
        '00000000-0000-0000-0000-000000000022'
      )
    ).toBe('node');
  });

  it('accepts regular versioned UUIDs and uppercase hexadecimal digits', () => {
    expect(
      validateLockResource(
        'entity',
        'A81BC81B-DEAD-4E5D-ABFF-90865D1E13B1'
      )
    ).toBe('entity');
  });

  it.each([
    '',
    '22',
    '00000000-0000-0000-0000-00000000002Z',
    '00000000000000000000000000000022',
    '../00000000-0000-0000-0000-000000000022',
  ])('rejects malformed identifier %j', (resourceId) => {
    expect(() => validateLockResource('node', resourceId)).toThrow(
      'Invalid lock resource identifier.'
    );
  });

  it('rejects unsupported resource types', () => {
    expect(() =>
      validateLockResource(
        'user',
        '00000000-0000-0000-0000-000000000022'
      )
    ).toThrow('Unsupported lock resource type.');
  });
});
