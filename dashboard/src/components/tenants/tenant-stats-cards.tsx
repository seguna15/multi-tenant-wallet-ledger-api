'use client';

import { AlertTriangle, ArrowLeftRight, Users, Wallet, type LucideIcon } from 'lucide-react';
import { useTenantStats } from '@/api/hooks/use-tenants';
import { ResponsiveGrid, SkeletonStats } from '@ledger/ui';

function StatCard({ label, value, icon: Icon }: { label: string; value: number; icon: LucideIcon }) {
  return (
    <div className="bg-card rounded-xl border p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-muted-foreground text-sm font-medium">{label}</p>
        <Icon className="text-muted-foreground h-4 w-4" />
      </div>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}

export function TenantStatsCards({ id }: { id: string }) {
  const { data, isPending, isError } = useTenantStats(id);

  // Throwing here is what lets the parent <ErrorBoundary> catch it.
  if (isError) throw new Error('Failed to load tenant stats');
  if (isPending) return <SkeletonStats count={4} />;

    return (
      <ResponsiveGrid cols="stats">
        <StatCard label="Wallets" value={data?.walletCount ?? 0} icon={Wallet} />
        <StatCard label="Users" value={data?.userCount ?? 0} icon={Users} />
        <StatCard label="Transfers (30d)" value={data?.transferCount30d ?? 0} icon={ArrowLeftRight} />
        <StatCard label="Unresolved Failed Events" value={data?.unresolvedFailedEvents ?? 0} icon={AlertTriangle} />
      </ResponsiveGrid>
    );

}
