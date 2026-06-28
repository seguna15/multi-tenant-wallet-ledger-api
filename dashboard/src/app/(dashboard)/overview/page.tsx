'use client';

import { Calendar, Clock, type LucideIcon } from 'lucide-react';
import { useMyTenant, useApiKeyMetadata } from '@/api/hooks/use-tenant';
import { Badge, ErrorBoundary, SkeletonRows, SkeletonCards, ResponsiveGrid } from '@ledger/ui';
import { cn } from '@ledger/utils';
import { COPY } from '@/constants/copy';

function MetaCard({ label, value, icon: Icon }: { label: string; value: string; icon?: LucideIcon }) {
  return (
    <div className="bg-card rounded-xl border p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-muted-foreground text-sm font-medium">{label}</p>
        {Icon && <Icon className="text-muted-foreground h-4 w-4" />}
      </div>
      <p className="mt-1 text-base font-semibold">{value}</p>
    </div>
  );
}

function TenantHeaderSection() {
  const { data: tenant, isPending, isError } = useMyTenant();

  // Throwing here is what lets the parent <ErrorBoundary> catch it.
  if (isError) throw new Error('Failed to load tenant');
  if (isPending) return <SkeletonRows count={1} />;

  return (
    <div className="flex items-center gap-3">
      <h1 className="text-2xl font-semibold">{tenant?.name}</h1>
      <Badge
        className={cn(
          'rounded-full px-3 py-1 text-xs font-medium',
          tenant?.isActive ? 'bg-green-100 text-green-700' : 'bg-muted text-muted-foreground',
        )}
      >
        {tenant?.isActive ? COPY.tenants.statusActive : COPY.tenants.statusInactive}
      </Badge>
    </div>
  );
}

function ApiKeyMetaSection() {
  const { data: keyMeta, isPending, isError } = useApiKeyMetadata();

  if (isError) throw new Error('Failed to load API key metadata');
  if (isPending) return <SkeletonCards count={2} />;

  return (
    <ResponsiveGrid cols="cards">
      <MetaCard
        label="API Key Last Used"
        value={keyMeta?.lastUsedAt ? new Date(keyMeta.lastUsedAt).toLocaleDateString() : 'Never'}
        icon={Clock}
      />
      <MetaCard
        label="API Key Expires"
        value={keyMeta?.expiresAt ? new Date(keyMeta.expiresAt).toLocaleDateString() : '—'}
        icon={Calendar}
      />
    </ResponsiveGrid>
  );
}


export default function OverviewPage() {
  return (
    <div className="space-y-6">
      <ErrorBoundary title="Couldn't load tenant info">
        <TenantHeaderSection />
      </ErrorBoundary>

      <ErrorBoundary title="Couldn't load API key details">
        <ApiKeyMetaSection />
      </ErrorBoundary>
    </div>
  );
}
