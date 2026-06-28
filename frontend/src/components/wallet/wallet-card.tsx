'use client';

import { memo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff } from 'lucide-react';
import { cn, formatAccountNumber } from '@ledger/utils';
import { Badge } from '@ledger/ui';
import { useWalletBalance, type Wallet } from '@/api/hooks/use-wallet';

interface WalletCardProps {
  wallet: Wallet;
}

export const WalletCard = memo(function WalletCard({ wallet }: WalletCardProps) {
  const router = useRouter();
  const isOptimistic = wallet.id.startsWith('optimistic-');
  const [showBalance, setShowBalance] = useState(false);
  const { data: balance, isFetching: balancePending } = useWalletBalance(
    wallet.id,
    showBalance && !isOptimistic,
  );

  return (
    <div
      role="button"
      tabIndex={isOptimistic ? -1 : 0}
      onClick={() => !isOptimistic && router.push(`/wallet/${wallet.id}`)}
      onKeyDown={(e) => {
        if (!isOptimistic && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          router.push(`/wallet/${wallet.id}`);
        }
      }}
      aria-disabled={isOptimistic}
      className={cn(
        'bg-card hover:bg-accent w-full space-y-3 rounded-xl border p-6 text-left shadow-sm transition-colors',
        isOptimistic && 'cursor-default opacity-60',
        !isOptimistic && 'cursor-pointer',
      )}
    >
      <div className="flex items-center justify-between">
        <span className="text-lg font-semibold">{wallet.currency}</span>
        <Badge variant={wallet.isActive ? 'success' : 'secondary'}>
          {wallet.isActive ? 'Active' : 'Inactive'}
        </Badge>
      </div>

      <div>
        <div className="flex items-center gap-2">
          <p className="text-muted-foreground text-2xl font-bold tabular-nums">
            {isOptimistic ? (
              <span className="text-muted-foreground text-sm">Creating…</span>
            ) : showBalance ? (
              balancePending ? (
                <span className="text-muted-foreground text-sm">Loading…</span>
              ) : (
                balance?.balance.toFixed(2) ?? '—'
              )
            ) : (
              '••••••'
            )}
          </p>
          {!isOptimistic && (
            <button
              type="button"
              aria-label={showBalance ? 'Hide balance' : 'Show balance'}
              onClick={(e) => {
                e.stopPropagation();
                setShowBalance((prev) => !prev);
              }}
              className="text-muted-foreground hover:text-foreground"
            >
              {showBalance ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          )}
        </div>
        <p className="text-muted-foreground text-xs">
          {isOptimistic ? ' ' : showBalance ? 'Tap eye to hide balance' : 'Tap eye to view balance'}
        </p>
      </div>

      <div className="space-y-1 border-t pt-3">
        <p className="text-muted-foreground font-mono text-xs">
          {formatAccountNumber(wallet.accountNumber)}
        </p>
        <p className="text-muted-foreground text-xs">
          {new Date(wallet.createdAt).toLocaleDateString(undefined, {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
          })}
        </p>
      </div>
    </div>
  );
});
