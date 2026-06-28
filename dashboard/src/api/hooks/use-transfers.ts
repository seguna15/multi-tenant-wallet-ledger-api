import { useMutation, useQuery } from '@tanstack/react-query';
import { apiClient, API_KEY, BASE_URL } from '@/api/api-client';
import { buildQueryString, downloadCsv, ApiError } from '@ledger/utils';
import type { TransferListQuery, TransferPage } from '@ledger/types';

export type { Transfer, TransferStatus, TransferPage, TransferListQuery } from '@ledger/types';

// Backend: GET /admin/transfers (AdminJwtAuthGuard + RolesGuard(TENANT_ADMIN))
export function useTenantTransfers(filters: TransferListQuery) {
  return useQuery({
    queryKey: ['admin', 'transfers', filters],
    queryFn: () => apiClient.get<TransferPage>(`/admin/transfers?${buildQueryString(filters)}`),
    placeholderData: (previous) => previous,
  });
}

export type ExportTenantTransfersFilters = Pick<
  TransferListQuery,
  'status' | 'from' | 'to' | 'accountNumber'
>;

async function fetchTenantTransfersExport(filters: ExportTenantTransfersFilters): Promise<Blob> {
  const res = await fetch(`${BASE_URL}/admin/transfers/export?${buildQueryString(filters)}`, {
    credentials: 'include',
    headers: { 'x-api-key': API_KEY },
  });

  if (!res.ok || !res.body) {
    const payload = await res.json().catch(() => ({}));
    throw new ApiError({ statusCode: res.status, message: payload?.message ?? res.statusText });
  }

  const reader = res.body.getReader();
  const chunks: Uint8Array<ArrayBuffer>[] = [];
  for (let chunk = await reader.read(); !chunk.done; chunk = await reader.read()) {
    chunks.push(chunk.value);
  }

  return new Blob(chunks, { type: 'text/csv' });
}

// Backend: GET /admin/transfers/export (AdminJwtAuthGuard + RolesGuard(TENANT_ADMIN))
export function useExportTenantTransfers() {
  return useMutation({
    mutationFn: (filters: ExportTenantTransfersFilters) =>
      fetchTenantTransfersExport(filters).then((blob) => downloadCsv('transfers.csv', blob)),
  });
}
