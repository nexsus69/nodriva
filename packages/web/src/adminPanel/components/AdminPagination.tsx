"use client";

/** Renders the shared collection pagination controls for every Admin Panel list. */
import { useAppLocale } from "@/app/i18n/AppLocaleStore";

export function AdminPagination({
  page,
  pageCount,
  onPageChange,
}: {
  page: number;
  pageCount: number;
  onPageChange: (page: number) => void;
}) {
  const { t } = useAppLocale();
  const windowSize = Math.min(5, pageCount);
  const firstPage = Math.min(
    Math.max(1, page - Math.floor(windowSize / 2)),
    Math.max(1, pageCount - windowSize + 1),
  );
  const pages = Array.from({ length: windowSize }, (_, index) => firstPage + index);
  return (
    <nav
      className="flex items-center justify-between gap-4 border border-slate-200 bg-white px-4 py-3 text-sm"
      aria-label={t("admin.pagination")}
    >
      <button
        type="button"
        disabled={page <= 1}
        onClick={() => onPageChange(Math.max(1, page - 1))}
        className="font-semibold text-indigo-600 disabled:text-slate-300"
      >
        {t("admin.previous")}
      </button>
      <div
        className="flex items-center gap-1"
        aria-label={t("admin.pageOf")
          .replace("{page}", String(page))
          .replace("{pages}", String(pageCount))}
      >
        {pages.map((pageNumber) => (
          <button
            key={pageNumber}
            type="button"
            aria-current={pageNumber === page ? "page" : undefined}
            onClick={() => onPageChange(pageNumber)}
            className={`min-w-8 px-2 py-1 font-semibold ${
              pageNumber === page
                ? "bg-indigo-600 text-white"
                : "text-indigo-600 hover:bg-indigo-50"
            }`}
          >
            {pageNumber}
          </button>
        ))}
      </div>
      <button
        type="button"
        disabled={page >= pageCount}
        onClick={() => onPageChange(Math.min(pageCount, page + 1))}
        className="font-semibold text-indigo-600 disabled:text-slate-300"
      >
        {t("admin.next")}
      </button>
    </nav>
  );
}
