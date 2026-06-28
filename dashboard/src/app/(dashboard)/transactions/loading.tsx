import { SkeletonRows } from '@ledger/ui';

export default function Loading() {
  return (
    <div className="space-y-6">
      <div className="bg-muted h-7 w-32 animate-pulse rounded" />
      <SkeletonRows />
    </div>
  );
}
