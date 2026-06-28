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
import { ALL_CURRENCIES, CURRENCIES, cn, formatAccountNumber, type CurrencyFilter } from '@ledger/utils';
import {
  ALL_WALLET_STATUSES,
  WALLET_STATUS_IS_ACTIVE,
  WALLET_STATUSES,
  WALLET_STATUS_LABELS,
  type Wallet,
  type WalletStatusFilter,
} from '@ledger/types';
import { useTenantWallets } from '@/api/hooks/use-wallets';
import { COPY } from '@/constants/copy';

const PAGE_SIZE = 20;

type WalletFilters = {
  currency: CurrencyFilter;
  status: WalletStatusFilter;
  from: string;
  to: string;
  accountNumber: string;
} & Record<string, string>;

const FILTER_FIELDS: EntityFilterField<WalletFilters>[] = [
  {
    type: 'select',
    key: 'currency',
    label: 'Currency',
    allValue: ALL_CURRENCIES,
    options: CURRENCIES,
    className: 'w-32',
  },
  {
    type: 'select',
    key: 'status',
    label: 'Status',
    allValue: ALL_WALLET_STATUSES,
    options: WALLET_STATUSES,
    labels: WALLET_STATUS_LABELS,
    className: 'w-32',
  },
  { type: 'dateRange', fromKey: 'from', toKey: 'to' },
  {
    type: 'search',
    key: 'accountNumber',
    label: 'Account number',
    placeholder: 'TN-a1b2c3-X9Y8Z7W6',
  },
];

export function WalletTable() {
  const { filters, setFilter, cursor, hasPreviousPage, goToNextPage, goToPreviousPage } =
    useCursorFilters<WalletFilters>({
      currency: ALL_CURRENCIES,
      status: ALL_WALLET_STATUSES,
      from: '',
      to: '',
      accountNumber: '',
    });

  const activeFilters = useMemo(
    () => ({
      currency: filters.currency === ALL_CURRENCIES ? undefined : filters.currency,
      isActive:
        filters.status === ALL_WALLET_STATUSES ? undefined : WALLET_STATUS_IS_ACTIVE[filters.status],
      from: filters.from || undefined,
      to: filters.to || undefined,
      accountNumber: filters.accountNumber || undefined,
    }),
    [filters],
  );

  const { data, isPending, isFetching } = useTenantWallets({
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
        <DataTable<Wallet>
          data={data?.items ?? []}
          rowKey={(w) => w.id}
          emptyMessage="No wallets match these filters."
          columns={[
            {
              key: 'accountNumber',
              header: 'Account Number',
              className: 'font-mono text-xs',
              cell: (w) => formatAccountNumber(w.accountNumber),
            },
            {
              key: 'currency',
              header: 'Currency',
              cell: (w) => w.currency,
            },
            {
              key: 'status',
              header: 'Status',
              cell: (w) => (
                <Badge
                  className={cn(
                    'rounded-full px-2.5 py-0.5 text-xs font-medium',
                    w.isActive ? 'bg-green-100 text-green-700' : 'bg-muted text-muted-foreground',
                  )}
                >
                  {w.isActive ? COPY.tenants.statusActive : COPY.tenants.statusInactive}
                </Badge>
              ),
            },
            {
              key: 'created',
              header: 'Created',
              className: 'text-muted-foreground whitespace-nowrap tabular-nums',
              cell: (w) => new Date(w.createdAt).toLocaleString(),
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
