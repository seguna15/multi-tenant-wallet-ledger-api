'use client';

import { useLedgerBalance, useJournalEntries } from '@/api/hooks/use-ledger';
import { formatCurrency, type Currency, cn } from '@ledger/utils';
import Link from 'next/link';

interface TransactionContentProps {
  walletId: string;
}

export function TransactionContent({ walletId }: TransactionContentProps) {
  const {
    data: balanceData,
    isPending: balancePending,
    isError: balanceError,
  } = useLedgerBalance(walletId);
  const { data: entriesData, isError: entriesError } = useJournalEntries(walletId);

  // Throwing here is what lets the parent <ErrorBoundary> catch it.
  if (balanceError || entriesError) throw new Error('Failed to load transaction data');

  return (
    <>
      <div className="flex items-end justify-between">
        {balancePending ? (
          <div className="bg-muted h-8 w-32 animate-pulse rounded" />
        ) : (
          <div className="text-right">
            <p className="text-2xl font-bold tabular-nums">
              {balanceData?.balance.toFixed(2) ?? '—'}{' '}
              <span className="text-muted-foreground text-base font-normal">
                {balanceData?.currency}
              </span>
            </p>
            <p className="text-muted-foreground text-xs">Current balance</p>
          </div>
        )}
      </div>

      {!entriesData || entriesData.items.length === 0 ? (
        <p className="text-muted-foreground text-sm">No transactions yet.</p>
      ) : (
        <div className="rounded-xl border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-muted-foreground px-4 py-3 text-left font-medium">Date</th>
                <th className="text-muted-foreground px-4 py-3 text-left font-medium">Type</th>
                <th className="text-muted-foreground px-4 py-3 text-right font-medium">Amount</th>
                <th className="text-muted-foreground hidden px-4 py-3 text-left font-medium sm:table-cell">
                  Reference
                </th>
              </tr>
            </thead>
            <tbody>
              {entriesData.items.map((entry) => (
                <tr key={entry.id} className="border-b last:border-0">
                  <td className="text-muted-foreground px-4 py-3 tabular-nums">
                    {new Date(entry.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        'rounded-full px-3 py-1 text-xs font-medium',
                        entry.type === 'CREDIT'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-red-100 text-red-700',
                      )}
                    >
                      {entry.type}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-medium tabular-nums">
                    {entry.type === 'CREDIT' ? '+' : '-'}
                    {balanceData
                      ? formatCurrency(BigInt(entry.amount), balanceData.currency as Currency)
                      : entry.amount}
                  </td>
                  <td className="hidden px-4 py-3 font-mono text-xs sm:table-cell">
                    <Link
                      href={`/transfer/${entry.transferId}`}
                      className="text-muted-foreground hover:text-foreground underline-offset-2 hover:underline"
                    >
                      {entry.transferId.slice(0, 8)}…
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
