import { Suspense } from 'react';
import { PageHeader, SkeletonRows } from '@ledger/ui';
import { DlqTable } from './_components/dlq-table';

export default function DlqPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Failed Events"
        description="Webhook and transfer events that exhausted their retries. Replaying re-queues the original payload for processing."
      />
      <Suspense fallback={<SkeletonRows />}>
        <DlqTable />
      </Suspense>
    </div>
  );
}
