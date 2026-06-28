'use client';

import { useMemo } from 'react';
import {
  Badge,
  CursorPagination,
  DataTable,
  EntityFilterBar,
  SkeletonRows,
  useCursorFilters,
  type EntityFilterField,
} from '@ledger/ui';
import { useDlqEvents, type DlqEvent } from '@/api/hooks/use-dlq';
import { ReplayButton } from './replay-button';

const PAGE_SIZE = 20;

const ALL_QUEUES = 'ALL';
const ALL_STATUSES = 'ALL';

// Mirrors DLQ_QUEUES in api/src/modules/outbox/dto/list-dlq-events-query.dto.ts
const QUEUES = ['transfer.initiated.dlq', 'transfer.completed.dlq', 'notification.transfer.dlq'] as const;
const QUEUE_LABELS: Record<string, string> = {
  'transfer.initiated.dlq': 'Transfer Initiated',
  'transfer.completed.dlq': 'Transfer Completed',
  'notification.transfer.dlq': 'Notification / Webhook',
};

const STATUSES = ['UNRESOLVED'] as const;
const STATUS_LABELS: Record<string, string> = {
  UNRESOLVED: 'Unresolved only',
};

const REASON_LABELS: Record<DlqEvent['reason'], string> = {
  MALFORMED_MESSAGE: 'Malformed message',
  MAX_RETRIES_EXHAUSTED: 'Retries exhausted',
};

type DlqFilters = {
  queue: string;
  status: string;
} & Record<string, string>;

const FILTER_FIELDS: EntityFilterField<DlqFilters>[] = [
  {
    type: 'select',
    key: 'queue',
    label: 'Queue',
    allValue: ALL_QUEUES,
    options: QUEUES,
    labels: QUEUE_LABELS,
    className: 'w-56',
  },
  {
    type: 'select',
    key: 'status',
    label: 'Status',
    allValue: ALL_STATUSES,
    options: STATUSES,
    labels: STATUS_LABELS,
    className: 'w-40',
  },
];

export function DlqTable() {
  const { filters, setFilter, cursor, hasPreviousPage, goToNextPage, goToPreviousPage } =
    useCursorFilters<DlqFilters>({
      queue: ALL_QUEUES,
      status: ALL_STATUSES,
    });

  const activeFilters = useMemo(
    () => ({
      queue: filters.queue === ALL_QUEUES ? undefined : filters.queue,
      unresolved: filters.status === 'UNRESOLVED' ? true : undefined,
    }),
    [filters],
  );

  const { data, isPending, isFetching } = useDlqEvents({
    ...activeFilters,
    cursor,
    limit: PAGE_SIZE,
  });

  return (
    <div className="space-y-4">
      <EntityFilterBar fields={FILTER_FIELDS} filters={filters} onChange={setFilter} />

      {isPending ? (
        <SkeletonRows />
      ) : (
        <DataTable<DlqEvent>
          data={data?.items ?? []}
          rowKey={(e) => e.id}
          emptyMessage="No dead-lettered events match these filters."
          columns={[
            {
              key: 'queue',
              header: 'Queue',
              cell: (e) => QUEUE_LABELS[e.queue] ?? e.queue,
            },
            {
              key: 'reason',
              header: 'Reason',
              cell: (e) => (
                <Badge variant={e.reason === 'MALFORMED_MESSAGE' ? 'destructive' : 'warning'}>
                  {REASON_LABELS[e.reason] ?? e.reason}
                </Badge>
              ),
            },
            {
              key: 'correlationId',
              header: 'Correlation ID',
              className: 'font-mono text-xs',
              cell: (e) => e.correlationId ?? '—',
            },
            {
              key: 'createdAt',
              header: 'Failed At',
              className: 'text-muted-foreground whitespace-nowrap tabular-nums',
              cell: (e) => new Date(e.createdAt).toLocaleString(),
            },
            {
              key: 'status',
              header: 'Status',
              cell: (e) =>
                e.replayedAt ? (
                  <Badge variant="success">Replayed {new Date(e.replayedAt).toLocaleString()}</Badge>
                ) : (
                  <Badge variant="secondary">Unresolved</Badge>
                ),
            },
            {
              key: 'actions',
              header: '',
              align: 'right',
              cell: (e) => <ReplayButton event={e} />,
            },
          ]}
        />
      )}

      <CursorPagination
        onPrevious={goToPreviousPage}
        onNext={() => goToNextPage(data?.nextCursor)}
        hasPrevious={hasPreviousPage}
        hasNext={!!data?.nextCursor}
        isLoading={isFetching}
      />
    </div>
  );
}
