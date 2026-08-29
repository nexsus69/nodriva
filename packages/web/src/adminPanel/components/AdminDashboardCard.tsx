"use client";

/** Provides the shared destination-card contract used by administrative dashboards. */
import Link from "@/app/components/navigation/GuardedLink";
import { AdminIcon } from "./AdminIcon";

export function AdminDashboardCard({
  title,
  description,
  icon,
  href,
  children,
}: {
  title: string;
  description: string;
  icon: string;
  href?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border border-slate-200 bg-white shadow-sm">
      <div className="flex items-start gap-3 border-b border-slate-200 px-5 py-4">
        <span className="flex size-9 shrink-0 items-center justify-center bg-violet-50 text-violet-700">
          <AdminIcon name={icon} className="size-4.5" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold text-slate-950">{title}</h2>
          <p className="mt-1 text-xs leading-5 text-slate-500">{description}</p>
        </div>
        {href && (
          <Link
            href={href}
            className="text-xs font-semibold text-violet-700 hover:text-violet-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
          >
            {"→"}
          </Link>
        )}
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}
