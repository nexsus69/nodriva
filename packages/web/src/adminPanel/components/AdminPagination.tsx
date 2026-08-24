"use client";

/** Renders the shared collection pagination controls for every Admin Panel list. */
import { useAppLocale } from "@/app/i18n/AppLocaleStore";
import { AdminIcon } from "./AdminIcon";

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
      className="flex flex-wrap items-center justify-between gap-3 border border-slate-200 bg-white px-3 py-2.5 text-sm shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
      aria-label={t("admin.pagination")}
    >
      <button
        type="button"
        disabled={page <= 1}
        onClick={() => onPageChange(Math.max(1, page - 1))}
        aria-label={t("admin.previous")}
        className="inline-flex size-8 items-center justify-center border border-slate-200 text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-300"
      >
        <AdminIcon name="chevron-left" className="size-4" />
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
            className={`size-8 border text-xs font-semibold tabular-nums transition ${
              pageNumber === page
                ? "border-violet-600 bg-violet-600 text-white"
                : "border-transparent text-slate-600 hover:border-slate-200 hover:bg-slate-50"
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
        aria-label={t("admin.next")}
        className="inline-flex size-8 items-center justify-center border border-slate-200 text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-300"
      >
        <AdminIcon name="chevron-right" className="size-4" />
      </button>
    </nav>
  );
}
