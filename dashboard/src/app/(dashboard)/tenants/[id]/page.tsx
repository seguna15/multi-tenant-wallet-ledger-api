'use client';

import { use, useCallback } from 'react';
import { useTenant, useToggleTenantActivation } from '@/api/hooks/use-tenants';
import { Badge, Button, ErrorBoundary, SkeletonCards, SkeletonRows } from '@ledger/ui';
import { COPY } from '@/constants/copy';
import { TenantStatsCards } from '@/components/tenants/tenant-stats-cards';

function TenantHeaderSection({ id }: { id: string }) {
  const { data: tenant, isPending, isError } = useTenant(id);

  // Throwing here is what lets the parent <ErrorBoundary> catch it.
  if (isError) throw new Error('Failed to load tenant');
  if (isPending) return <SkeletonRows count={1} />;
  if (!tenant) return <div className="text-destructive text-sm">Tenant not found.</div>;

  return (
    <div className="flex items-center gap-3">
      <h1 className="text-2xl font-semibold">{tenant.name}</h1>
      <Badge variant={tenant.isActive ? 'success' : 'destructive'}>
        {tenant.isActive ? COPY.tenants.statusActive : COPY.tenants.statusInactive}
      </Badge>
    </div>
  );
}

function TenantDetailSection({ id }: { id: string }) {
  const { data: tenant, isPending, isError } = useTenant(id);
  const { mutate: toggle, isPending: toggling } = useToggleTenantActivation();

  const handleToggle = useCallback(() => {
    if (tenant) toggle(tenant.id);
  }, [tenant, toggle]);

  if (isError) throw new Error('Failed to load tenant details');
  if (isPending) return <SkeletonCards count={1} />;
  if (!tenant) return <div className="text-destructive text-sm">Tenant not found.</div>;

  return (
    <div className="bg-card max-w-sm space-y-4 rounded-xl border p-6 shadow-sm">
      <div className="grid grid-cols-2 gap-y-3 text-sm">
        <span className="text-muted-foreground">Type</span>
        <span className="font-medium">{tenant.type}</span>
        <span className="text-muted-foreground">Created</span>
        <span className="font-medium">{new Date(tenant.createdAt).toLocaleDateString()}</span>
      </div>

      <Button
        variant={tenant.isActive ? 'destructive' : 'default'}
        disabled={toggling}
        onClick={handleToggle}
      >
        {toggling ? 'Updating…' : tenant.isActive ? 'Deactivate Tenant' : 'Activate Tenant'}
      </Button>
    </div>
  );
}

export default function TenantDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  return (
    <div className="space-y-6">
      <ErrorBoundary title="Couldn't load tenant">
        <TenantHeaderSection id={id} />
      </ErrorBoundary>

      <ErrorBoundary title="Couldn't load tenant stats">
        <TenantStatsCards id={id} />
      </ErrorBoundary>

      <ErrorBoundary title="Couldn't load tenant details">
        <TenantDetailSection id={id} />
      </ErrorBoundary>
    </div>
  );
}
