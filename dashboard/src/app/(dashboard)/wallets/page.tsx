import { Suspense } from 'react';
import { PageHeader, ResponsiveGrid, SkeletonRows } from '@ledger/ui';
import { ActivityFeed } from '@/components/dashboard/activity-feed';
import { WalletTable } from './_components/wallet-table';

export default function WalletsPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Wallets" />
      <ResponsiveGrid cols="cards" className="gap-6">
        <div className="lg:col-span-2">
          <Suspense fallback={<SkeletonRows />}>
            <WalletTable />
          </Suspense>
        </div>
        <ActivityFeed />
      </ResponsiveGrid>
    </div>
  );
}
