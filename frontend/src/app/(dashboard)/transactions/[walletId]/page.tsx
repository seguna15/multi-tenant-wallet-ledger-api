import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Suspense } from 'react';
import { ErrorBoundary, PageHeader } from '@ledger/ui';
import { TransactionContent } from './_components/transaction-content';

export default async function TransactionsPage({
  params,
}: {
  params: Promise<{ walletId: string }>;
}) {
  const { walletId } = await params;

  return (
    <div className="space-y-6">
      <Link
        href="/wallet"
        className="text-muted-foreground hover:text-foreground flex w-fit items-center gap-1 text-sm transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to wallets
      </Link>

      <PageHeader title="Transactions" />

      <ErrorBoundary title="Couldn't load transactions">
        <Suspense
          fallback={
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="bg-muted h-12 animate-pulse rounded-lg border" />
              ))}
            </div>
          }
        >
          <TransactionContent walletId={walletId} />
        </Suspense>
      </ErrorBoundary>
    </div>
  );
}
