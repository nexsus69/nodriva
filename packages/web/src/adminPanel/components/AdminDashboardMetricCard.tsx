"use client";

/** Renders one linked administrative metric with the shared asynchronous state treatment. */
import { AdminDashboardCard } from "./AdminDashboardCard";
import { AdminDashboardReadState, type AdminDashboardReadStateValue } from "./AdminDashboardReadState";

export function AdminDashboardMetricCard({
  title,
  description,
  icon,
  href,
  state,
  error,
  unavailableLabel,
  children,
}: {
  title: string;
  description: string;
  icon: string;
  href: string;
  state: AdminDashboardReadStateValue;
  error: string | null;
  unavailableLabel: string;
  children: React.ReactNode;
}) {
  return (
    <AdminDashboardCard title={title} description={description} icon={icon} href={href}>
      <AdminDashboardReadState state={state} error={error} unavailableLabel={unavailableLabel}>
        {children}
      </AdminDashboardReadState>
    </AdminDashboardCard>
  );
}
