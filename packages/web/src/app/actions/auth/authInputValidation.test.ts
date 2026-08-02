import { describe, expect, it } from 'vitest';
import { parseLoginCredentials } from './authInputValidation';

describe('parseLoginCredentials', () => {
  it('normalizes a valid email without altering the password', () => {
    expect(parseLoginCredentials({ email: '  User@example.com ', password: ' p ass ' })).toEqual({
      email: 'User@example.com',
      password: ' p ass ',
    });
  });

  it.each([
    null,
    undefined,
    {},
    { email: 'user@example.com' },
    { email: 'invalid-email', password: 'secret' },
    { email: 'user@example.com', password: '' },
    { email: 42, password: 'secret' },
    { email: 'user@example.com', password: { value: 'secret' } },
  ])('rejects malformed credentials: %j', (input) => {
    expect(parseLoginCredentials(input)).toBeNull();
  });

  it('rejects excessively long credentials', () => {
    expect(parseLoginCredentials({ email: `${'a'.repeat(246)}@test.com`, password: 'secret' })).toBeNull();
    expect(parseLoginCredentials({ email: 'user@example.com', password: 'x'.repeat(1025) })).toBeNull();
  });
});
