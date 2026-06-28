import { ErrorBoundary, PageHeader, SkeletonRows } from '@ledger/ui';
import { TransactionHistory } from './_components/transaction-history';
import { Suspense } from 'react';

export default function TransactionsPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Transactions" />
      <ErrorBoundary title="Couldn't load transactions">
        <Suspense fallback={<SkeletonRows />}>
          <TransactionHistory />
        </Suspense>
      </ErrorBoundary>
    </div>
  );
}
