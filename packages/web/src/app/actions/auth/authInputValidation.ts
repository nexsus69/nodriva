export interface LoginCredentials {
  email: string;
  password: string;
}

const MAX_PASSWORD_LENGTH = 1024;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Runtime validation for values crossing the Server Action/NextAuth boundary.
 * TypeScript types are not present at runtime, so casts at this boundary are
 * unsafe and can pass objects or empty values into the authentication service.
 */
export function parseLoginCredentials(input: unknown): LoginCredentials | null {
  if (typeof input !== 'object' || input === null) {
    return null;
  }

  const candidate = input as Record<string, unknown>;
  const email = typeof candidate.email === 'string' ? candidate.email.trim() : '';
  const password = typeof candidate.password === 'string' ? candidate.password : '';

  if (
    email.length === 0 ||
    email.length > 254 ||
    !EMAIL_PATTERN.test(email) ||
    password.length === 0 ||
    password.length > MAX_PASSWORD_LENGTH
  ) {
    return null;
  }

  return { email, password };
}
