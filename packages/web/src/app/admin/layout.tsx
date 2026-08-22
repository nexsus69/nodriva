import { AdminPanelShell } from './_components/AdminPanelShell';

/** Provides the persistent Admin Panel frame for every administrative route. */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <AdminPanelShell>{children}</AdminPanelShell>;
}
