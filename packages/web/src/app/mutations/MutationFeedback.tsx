"use client";

/** Renders a mutation outcome without owning mapping, retry or pending state. */
import { Alert } from "@/app/components/ui/feedback";
import { useAppLocale } from "@/app/i18n/AppLocaleStore";
import type { UserMutationFailure } from "./useUserMutation";

export function MutationFeedback({
  failure,
  onRetry,
  className,
}: {
  failure: UserMutationFailure | null;
  onRetry: () => void;
  className?: string;
}) {
  const { t } = useAppLocale();
  if (!failure) return null;
  return (
    <Alert tone="danger" role="alert" className={className}>
      {failure.message}
      {failure.retryable && (
        <button type="button" className="ml-2 font-semibold underline" onClick={onRetry}>
          {t("common.retry")}
        </button>
      )}
    </Alert>
  );
}
