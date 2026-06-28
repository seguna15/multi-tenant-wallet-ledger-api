'use client';

import { ErrorState } from '@ledger/ui';

export default function TransactionsError({ reset }: { reset: () => void }) {
  return <ErrorState title="Failed to load transactions" onRetry={reset} />;
}
