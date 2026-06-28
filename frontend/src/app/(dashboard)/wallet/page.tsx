import { Suspense } from 'react';
import { ErrorBoundary, PageHeader, ResponsiveGrid } from '@ledger/ui';
import { WalletList } from './_components/wallet-list';
import { WalletListSkeleton } from './_components/wallet-list-skeleton';
import { CreateWalletDialog } from './_components/create-wallet-dialog';
import { ActivityFeed } from '@/components/wallet/activity-feed';

export default function WalletPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="My Wallets" actions={<CreateWalletDialog />} />

      <ResponsiveGrid cols="cards" className="gap-6">
        <div className="lg:col-span-2">
          <ErrorBoundary title="Couldn't load wallets">
            <Suspense fallback={<WalletListSkeleton />}>
              <WalletList />
            </Suspense>
          </ErrorBoundary>
        </div>
        <ActivityFeed />
      </ResponsiveGrid>
    </div>
  );
}
