'use client';

import { TransferStatusBadge } from '@ledger/ui';
import { cn, formatAccountNumber, formatCurrency, type Currency } from '@ledger/utils';
import { useTenantActivityFeed } from '@/api/hooks/use-transfer-activity';

export function ActivityFeed() {
  const { events, connectionStatus } = useTenantActivityFeed();

  return (
    <div className="bg-card h-fit space-y-3 rounded-xl border p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">Recent Activity</h2>
        <span className="text-muted-foreground flex items-center gap-1.5 text-xs">
          <span
            className={cn(
              'size-1.5 rounded-full',
              connectionStatus === 'live' ? 'bg-emerald-500' : 'bg-amber-500',
            )}
            aria-hidden
          />
          {connectionStatus === 'live'
            ? 'Live'
            : connectionStatus === 'polling'
              ? 'Polling'
              : 'Connecting…'}
        </span>
      </div>

      {events.length === 0 ? (
        <p className="text-muted-foreground text-sm">No recent transfers</p>
      ) : (
        <ul className="divide-y">
          {events.map((transfer) => (
            <li
              key={transfer.id}
              className="flex items-center justify-between gap-3 py-3 text-sm"
            >
              <div>
                <p className="font-medium">
                  {formatAccountNumber(transfer.walletFrom.accountNumber)} →{' '}
                  {formatAccountNumber(transfer.walletTo.accountNumber)}
                </p>
                <p className="text-muted-foreground text-xs">
                  {new Date(transfer.updatedAt).toLocaleString(undefined, {
                    month: 'short',
                    day: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit',
                  })}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="tabular-nums">
                  {formatCurrency(BigInt(transfer.fromAmount), transfer.fromCurrency as Currency)}
                </span>
                <TransferStatusBadge status={transfer.status} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
