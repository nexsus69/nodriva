/** Carries the one safe login-throttle code through Auth.js without account disclosure. */
import { CredentialsSignin } from 'next-auth';

export const LOGIN_RATE_LIMITED_CREDENTIALS_CODE = 'login_rate_limited';

export class LoginRateLimitCredentialsError extends CredentialsSignin {
  code = LOGIN_RATE_LIMITED_CREDENTIALS_CODE;
}
