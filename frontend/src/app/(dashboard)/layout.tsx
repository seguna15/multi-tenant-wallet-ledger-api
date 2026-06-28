import { cookies } from 'next/headers';
import { DashboardShell } from '@/components/dashboard/dashboard-shell';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const role = (await cookies()).get('user_role')?.value ?? null;

  return <DashboardShell role={role}>{children}</DashboardShell>;
}



