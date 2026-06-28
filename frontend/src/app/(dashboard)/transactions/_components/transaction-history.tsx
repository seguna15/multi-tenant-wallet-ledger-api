'use client';

import { useCallback, useMemo, useState } from 'react';
import { Download } from 'lucide-react';
import {
  Button,
  Spinner,
  TransferStatusBadge,
  CursorPagination,
  SkeletonRows,
  DataTable,
  EntityFilterBar,
  useCursorFilters,
  type EntityFilterField,
  toast,
} from '@ledger/ui';
import { formatAccountNumber, formatCurrency, type Currency } from '@ledger/utils';
import {
  ALL_STATUSES,
  TRANSFER_STATUSES,
  TRANSFER_STATUS_LABELS,
  type StatusFilter,
  type Transfer,
} from '@ledger/types';
import { useMyTransfers, useExportMyTransfers } from '@/api/hooks/use-transfers';
import { useMyWallets } from '@/api/hooks/use-wallet';

const PAGE_SIZE = 20;

type TransferFilters = {
  status: StatusFilter;
  from: string;
  to: string;
} & Record<string, string>;

const FILTER_FIELDS: EntityFilterField<TransferFilters>[] = [
  {
    type: 'select',
    key: 'status',
    label: 'Status',
    allValue: ALL_STATUSES,
    options: TRANSFER_STATUSES,
    labels: TRANSFER_STATUS_LABELS,
    className: 'w-40',
  },
  { type: 'dateRange', fromKey: 'from', toKey: 'to' },
];

export function TransactionHistory() {
  const { filters, setFilter, cursor, hasPreviousPage, goToNextPage, goToPreviousPage } =
    useCursorFilters<TransferFilters>({
      status: ALL_STATUSES,
      from: '',
      to: '',
    });

  const { data: walletsData } = useMyWallets();
  const myWalletIds = useMemo(
    () => new Set((walletsData?.items ?? []).map((w) => w.id)),
    [walletsData],
  );

  const activeFilters = useMemo(
    () => ({
      status: filters.status === ALL_STATUSES ? undefined : filters.status,
      from: filters.from || undefined,
      to: filters.to || undefined,
    }),
    [filters],
  );

  const { data, isPending, isFetching, isError } = useMyTransfers({
    ...activeFilters,
    cursor,
    limit: PAGE_SIZE,
  });

  const exportMutation = useExportMyTransfers();

  const handleExport = useCallback(() => {
    exportMutation.mutate(activeFilters, {
      onSuccess: () => toast.success('Export downloaded successfully.'),
      onError: () => toast.error('Failed to export transactions. Please try again.'),
    });
  }, [exportMutation, activeFilters]);
  if (isError) throw new Error('Failed to load transactions');


  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-4">
        <EntityFilterBar fields={FILTER_FIELDS} filters={filters} onChange={setFilter} />

        <Button
          variant="outline"
          onClick={handleExport}
          disabled={exportMutation.isPending || !data?.items?.length}
          className="ml-auto"
        >
          {exportMutation.isPending ? (
            <Spinner className="size-4" />
          ) : (
            <Download className="size-4" />
          )}
          Export CSV
        </Button>
      </div>

      {isPending ? (
        <SkeletonRows />
      ) : (
        <DataTable<Transfer>
          data={data?.items ?? []}
          rowKey={(t) => t.id}
          emptyMessage="No transactions match these filters."
          columns={[
            {
              key: 'date',
              header: 'Date',
              className: 'text-muted-foreground whitespace-nowrap tabular-nums',
              cell: (t) => new Date(t.createdAt).toLocaleDateString(),
            },
            {
              key: 'direction',
              header: 'Direction',
              cell: (t) => (myWalletIds.has(t.walletFromId) ? 'Sent' : 'Received'),
            },
            {
              key: 'counterparty',
              header: 'Counterparty',
              className: 'font-mono text-xs',
              cell: (t) => {
                const counterparty = myWalletIds.has(t.walletFromId) ? t.walletTo : t.walletFrom;
                return formatAccountNumber(counterparty.accountNumber);
              },
            },
            {
              key: 'amount',
              header: 'Amount',
              align: 'right',
              className: 'font-medium tabular-nums',
              cell: (t) => {
                const isOutgoing = myWalletIds.has(t.walletFromId);
                const amount = isOutgoing ? t.fromAmount : t.toAmount;
                const currency = (isOutgoing ? t.fromCurrency : t.toCurrency) as Currency;
                return `${isOutgoing ? '-' : '+'}${formatCurrency(BigInt(amount), currency)}`;
              },
            },
            {
              key: 'status',
              header: 'Status',
              cell: (t) => <TransferStatusBadge status={t.status} />,
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
