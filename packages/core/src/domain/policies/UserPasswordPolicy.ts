/** Defines the single password policy shared by server validation and browser guidance. */
export const USER_PASSWORD_POLICY = {
  minLength: 12,
  maxLength: 128,
} as const;

export const USER_PASSWORD_PATTERNS = {
  lowercase: /[a-z]/,
  uppercase: /[A-Z]/,
  number: /[0-9]/,
  special: /[^A-Za-z0-9]/,
} as const;

export type UserPasswordRequirement =
  | "minLength"
  | "maxLength"
  | "lowercase"
  | "uppercase"
  | "number"
  | "special";

/** Returns the requirements that the supplied password has not yet met. */
export function getUnmetUserPasswordRequirements(
  password: string,
): readonly UserPasswordRequirement[] {
  const unmet: UserPasswordRequirement[] = [];
  if (password.length < USER_PASSWORD_POLICY.minLength) unmet.push("minLength");
  if (password.length > USER_PASSWORD_POLICY.maxLength) unmet.push("maxLength");
  if (!USER_PASSWORD_PATTERNS.lowercase.test(password)) unmet.push("lowercase");
  if (!USER_PASSWORD_PATTERNS.uppercase.test(password)) unmet.push("uppercase");
  if (!USER_PASSWORD_PATTERNS.number.test(password)) unmet.push("number");
  if (!USER_PASSWORD_PATTERNS.special.test(password)) unmet.push("special");
  return unmet;
}

/** Determines whether a new password satisfies every authoritative requirement. */
export function isUserPasswordValid(password: string): boolean {
  return getUnmetUserPasswordRequirements(password).length === 0;
}
