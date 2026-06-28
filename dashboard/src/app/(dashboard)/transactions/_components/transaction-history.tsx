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
import { useTenantTransfers, useExportTenantTransfers } from '@/api/hooks/use-transfers';

const PAGE_SIZE = 20;

type TransferFilters = {
  status: StatusFilter;
  from: string;
  to: string;
  accountNumber: string;
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
  {
    type: 'search',
    key: 'accountNumber',
    label: 'Account number',
    placeholder: 'TN-a1b2c3-X9Y8Z7W6',
  },
];

export function TransactionHistory() {
  const { filters, setFilter, cursor, hasPreviousPage, goToNextPage, goToPreviousPage } =
    useCursorFilters<TransferFilters>({
      status: ALL_STATUSES,
      from: '',
      to: '',
      accountNumber: '',
    });

  const activeFilters = useMemo(
    () => ({
      status: filters.status === ALL_STATUSES ? undefined : filters.status,
      from: filters.from || undefined,
      to: filters.to || undefined,
      accountNumber: filters.accountNumber || undefined,
    }),
    [filters],
  );

  const { data, isPending, isFetching } = useTenantTransfers({
    ...activeFilters,
    cursor,
    limit: PAGE_SIZE,
  });

  const exportMutation = useExportTenantTransfers();

  const handleExport = useCallback(() => {
    exportMutation.mutate(activeFilters, {
      onSuccess: () => toast.success('Export downloaded successfully.'),
      onError: () => toast.error('Failed to export transactions. Please try again.'),
    });
  }, [exportMutation, activeFilters]);

  

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
              cell: (t) => new Date(t.createdAt).toLocaleString(),
            },
            {
              key: 'from',
              header: 'From',
              className: 'font-mono text-xs',
              cell: (t) => formatAccountNumber(t.walletFrom.accountNumber),
            },
            {
              key: 'to',
              header: 'To',
              className: 'font-mono text-xs',
              cell: (t) => formatAccountNumber(t.walletTo.accountNumber),
            },
            {
              key: 'amount',
              header: 'Amount',
              align: 'right',
              className: 'font-medium tabular-nums',
              cell: (t) => (
                <>
                  {formatCurrency(BigInt(t.fromAmount), t.fromCurrency as Currency)}
                  {t.fromCurrency !== t.toCurrency && (
                    <span className="text-muted-foreground block text-xs font-normal">
                      → {formatCurrency(BigInt(t.toAmount), t.toCurrency as Currency)}
                    </span>
                  )}
                </>
              ),
            },
            {
              key: 'status',
              header: 'Status',
              cell: (t) => <TransferStatusBadge status={t.status} />,
            },
            {
              key: 'reference',
              header: 'Reference',
              className: 'hidden font-mono text-xs sm:table-cell',
              cell: (t) => `${t.id.slice(0, 8)}…`,
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
