import { WalletListSkeleton } from './_components/wallet-list-skeleton';

export default function Loading() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="bg-muted h-8 w-32 animate-pulse rounded" />
        <div className="bg-muted h-9 w-28 animate-pulse rounded" />
      </div>
      <WalletListSkeleton />
    </div>
  );
}
