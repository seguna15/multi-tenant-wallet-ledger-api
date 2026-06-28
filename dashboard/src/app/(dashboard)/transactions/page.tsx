import { Suspense } from 'react';
import { PageHeader, SkeletonRows } from '@ledger/ui';
import { TransactionHistory } from './_components/transaction-history';

export default function TransactionsPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Transactions" />
      <Suspense fallback={<SkeletonRows />}>
        <TransactionHistory />
      </Suspense>
    </div>
  );
}
