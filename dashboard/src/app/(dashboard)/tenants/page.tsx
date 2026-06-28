'use client';

import Link from 'next/link';
import { Plus } from 'lucide-react';
import { useAllTenants } from '@/api/hooks/use-tenants';
import { Badge, ErrorBoundary, PageHeader, SkeletonRows } from '@ledger/ui';
import { COPY } from '@/constants/copy';

function TenantsTableSection() {
  const { data: tenants, isPending, isError } = useAllTenants();

  // Throwing here is what lets the parent <ErrorBoundary> catch it.
  if (isError) throw new Error('Failed to load tenants');
  if (isPending) return <SkeletonRows count={5} />;

  return (
    <div className="bg-card overflow-hidden rounded-xl border shadow-sm">
      <table className="w-full text-sm">
        <thead className="bg-muted/40 border-b">
          <tr>
            {['Name', 'Type', 'Status', 'Created', ''].map((h) => (
              <th key={h} className="text-muted-foreground px-4 py-3 text-left font-medium">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y">
          {tenants?.map((t) => (
            <tr key={t.id} className="hover:bg-muted/20">
              <td className="px-4 py-3 font-medium">{t.name}</td>
              <td className="text-muted-foreground px-4 py-3">{t.type}</td>
              <td className="px-4 py-3">
                <Badge variant={t.isActive ? 'success' : 'destructive'}>
                  {t.isActive ? COPY.tenants.statusActive : COPY.tenants.statusInactive}
                </Badge>
              </td>
              <td className="text-muted-foreground px-4 py-3">
                {new Date(t.createdAt).toLocaleDateString()}
              </td>
              <td className="px-4 py-3 text-right">
                <Link
                  href={`/tenants/${t.id}`}
                  className="text-primary text-sm font-medium hover:underline"
                >
                  Manage
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function TenantsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Tenants"
        actions={
          <Link
            href="/tenants/new"
            className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex items-center gap-1.5 rounded-md px-4 py-2 text-sm font-medium"
          >
            <Plus className="h-4 w-4" />
            New Tenant
          </Link>
        }
      />

      <ErrorBoundary title="Couldn't load tenants">
        <TenantsTableSection />
      </ErrorBoundary>
    </div>
  );
}
