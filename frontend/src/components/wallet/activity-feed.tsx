'use client';

import { useMemo } from 'react';
import { TransferStatusBadge } from '@ledger/ui';
import { cn, formatAccountNumber, formatCurrency, type Currency } from '@ledger/utils';
import { useTransferActivityFeed } from '@/api/hooks/use-transfer-activity';
import { useMyWallets } from '@/api/hooks/use-wallet';

export function ActivityFeed() {
  const { events, connectionStatus } = useTransferActivityFeed();
  const { data: walletsData } = useMyWallets();

  const myWalletIds = useMemo(
    () => new Set((walletsData?.items ?? []).map((w) => w.id)),
    [walletsData],
  );

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
          {events.map((transfer) => {
            const isOutgoing = myWalletIds.has(transfer.walletFromId);
            const counterparty = isOutgoing ? transfer.walletTo : transfer.walletFrom;
            const amount = isOutgoing ? transfer.fromAmount : transfer.toAmount;
            const currency = (isOutgoing ? transfer.fromCurrency : transfer.toCurrency) as Currency;

            return (
              <li
                key={transfer.id}
                className="flex items-center justify-between gap-3 py-3 text-sm"
              >
                <div>
                  <p className="font-medium">
                    {isOutgoing ? 'Sent to' : 'Received from'}{' '}
                    {formatAccountNumber(counterparty.accountNumber)}
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
                    {isOutgoing ? '-' : '+'}
                    {formatCurrency(BigInt(amount), currency)}
                  </span>
                  <TransferStatusBadge status={transfer.status} />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
