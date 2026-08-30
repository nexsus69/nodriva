"use client";

import { useState } from "react";
import { useAppLocale } from "@/app/i18n/AppLocaleStore";
import { formatAdminTechnicalIdentifier } from "@/adminPanel/adminFormatters";

/** Renders a compact technical identifier and optionally exposes full-value copy on touch devices. */
export function AdminTechnicalIdentifier({
  value,
  copyable = false,
}: {
  value: string;
  copyable?: boolean;
}) {
  const { t } = useAppLocale();
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);
  const displayValue = formatAdminTechnicalIdentifier(value);

  const copyValue = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setCopyFailed(false);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopyFailed(true);
    }
  };

  return (
    <span className="inline-flex min-w-0 items-center gap-2" title={value}>
      <span className="truncate" aria-label={value}>{displayValue}</span>
      {copyable && (
        <button
          type="button"
          className="shrink-0 text-xs font-semibold text-blue-700 underline decoration-blue-300 underline-offset-2 hover:text-blue-900"
          onClick={() => void copyValue()}
          aria-label={t("admin.copyTechnicalId")}
        >
          {copied ? t("admin.technicalIdCopied") : copyFailed ? t("admin.technicalIdCopyFailed") : t("admin.copy")}
        </button>
      )}
    </span>
  );
}
