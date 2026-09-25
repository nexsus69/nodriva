"use client";

/** Presents the authoritative password requirements while the user types. */
import {
  getUnmetUserPasswordRequirements,
  USER_PASSWORD_POLICY,
  type UserPasswordRequirement,
} from "@dashboard/core/browser";
import { useAppLocale } from "../../../i18n/AppLocaleStore";

const requirementMessageKey: Record<UserPasswordRequirement, string> = {
  minLength: "password.requirement.minLength",
  maxLength: "password.requirement.maxLength",
  lowercase: "password.requirement.lowercase",
  uppercase: "password.requirement.uppercase",
  number: "password.requirement.number",
  special: "password.requirement.special",
};

const visibleRequirements: readonly UserPasswordRequirement[] = [
  "minLength",
  "maxLength",
  "lowercase",
  "uppercase",
  "number",
  "special",
];

export function PasswordRequirements({ password }: { password: string }) {
  const { t } = useAppLocale();
  const unmet = new Set(getUnmetUserPasswordRequirements(password));

  return (
    <ul className="mt-2 space-y-0.5 text-[11px]" aria-label={t("password.requirements")}>
      {visibleRequirements.map((requirement) => {
        const met = !unmet.has(requirement);
        const message = requirement === "minLength"
          ? t(requirementMessageKey[requirement]).replace("{count}", String(USER_PASSWORD_POLICY.minLength))
          : t(requirementMessageKey[requirement]);
        return (
          <li key={requirement} className={met ? "text-emerald-600" : "text-rose-600"}>
            <span className="mr-1" aria-hidden="true">{met ? "✓" : "✕"}</span>
            {message}
          </li>
        );
      })}
    </ul>
  );
}
