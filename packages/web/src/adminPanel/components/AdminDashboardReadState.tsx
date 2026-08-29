"use client";

/** Keeps loading and unavailable presentation consistent across dashboard sections. */
import { Alert, Skeleton } from "@/app/components/ui/feedback";

export type AdminDashboardReadStateValue = "hidden" | "loading" | "ready" | "unavailable";

export function AdminDashboardReadState({
  state,
  error,
  unavailableLabel,
  children,
}: {
  state: AdminDashboardReadStateValue;
  error: string | null;
  unavailableLabel: string;
  children: React.ReactNode;
}) {
  if (state === "hidden") return null;
  if (state === "loading") return <Skeleton className="h-14 w-full" />;
  if (state === "unavailable") return <Alert tone="danger">{error || unavailableLabel}</Alert>;
  return <>{children}</>;
}
