'use client';

import { useMyWallets } from '@/api/hooks/use-wallet';
import { WalletCard } from '@/components/wallet/wallet-card';
import { WalletListSkeleton } from './wallet-list-skeleton';
import { CreateWalletDialog } from './create-wallet-dialog';
import { COPY } from '@/constants/copy';

export function WalletList() {
  const { data, isPending, isError } = useMyWallets();

  // Throwing here is what lets the parent <ErrorBoundary> catch it.
  if (isError) throw new Error('Failed to load wallets');
  if (isPending) return <WalletListSkeleton />;

  if (!data || data.items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-16 text-center">
        <p className="text-muted-foreground text-sm">{COPY.wallets.emptyState}</p>
        <p className="text-muted-foreground mt-1 text-xs">{COPY.wallets.emptyStateDescription}</p>
        <div className="mt-4">
          <CreateWalletDialog />
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {data.items.map((wallet) => (
        <WalletCard key={wallet.id} wallet={wallet} />
      ))}
    </div>
  );
}
