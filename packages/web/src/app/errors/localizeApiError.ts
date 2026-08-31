import type { ApiErrorResponse, ApiErrorDetail } from "@dashboard/core";

type Translator = (key: string) => string;

const ERROR_KEYS: Record<string, string> = {
  ROW_VERSION_MISMATCH: "errors.rowVersionMismatch",
  ACCESS_FORBIDDEN: "errors.accessForbidden",
  AUTH_UNAUTHORIZED: "errors.authUnauthorized",
  NOT_FOUND: "errors.notFound",
  INTERNAL_ERROR: "errors.internal",
  VALIDATION_ERROR: "admin.validationFailed",
  TYPE_HAS_INSTANCES: "errors.typeHasInstances",
  TYPE_FIELD_HAS_VALUES: "errors.typeFieldHasValues",
  FIELD_ENCRYPTED_VALUES_EXIST: "errors.fieldEncryptedValuesExist",
  FIELD_ENCRYPTION_DISABLED: "errors.fieldEncryptionDisabled",
};

const DETAIL_KEYS: Record<string, string> = {
  FIELD_ENCRYPTED_VALUES_EXIST: "errors.fieldEncryptedValuesExist",
  FIELD_ENCRYPTION_DISABLED: "errors.fieldEncryptionDisabled",
};

export function localizeApiError(error: ApiErrorResponse, t: Translator): string {
  const key = error.messageKey ?? ERROR_KEYS[error.code];
  return key ? t(key) : error.message;
}

export function localizeApiErrorDetail(detail: ApiErrorDetail, t: Translator): string {
  const key = DETAIL_KEYS[detail.code];
  if (key) return t(key);
  if (detail.message.includes("at least 1")) return t("admin.validationRequired");
  if (detail.message.includes("at most")) return t("admin.validationTooLong");
  if (/encrypted values still exist/i.test(detail.message)) return t("errors.fieldEncryptedValuesExist");
  if (/enable data\.fieldsEncryptionEnabled/i.test(detail.message)) return t("errors.fieldEncryptionDisabled");
  if (/invalid/i.test(detail.message)) return t("admin.validationInvalid");
  return detail.message;
}

export function localizeUnknownError(reason: unknown, t: Translator, fallbackKey = "errors.internal"): string {
  if (reason && typeof reason === "object" && typeof Reflect.get(reason, "code") === "string") {
    return localizeApiError(reason as ApiErrorResponse, t);
  }
  return t(fallbackKey);
}
