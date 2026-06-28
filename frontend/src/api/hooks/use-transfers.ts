import { useMutation, useQuery } from '@tanstack/react-query';
import { API_KEY, apiClient, BASE_URL } from '@/api/api-client';
import { ApiError, buildQueryString, downloadCsv } from '@ledger/utils';
import type { TransferListQuery, TransferPage } from '@ledger/types';

export type { Transfer, TransferStatus, TransferPage, TransferListQuery } from '@ledger/types';

export function useMyTransfers(filters: TransferListQuery) {
  return useQuery({
    queryKey: ['transfers', 'me', filters],
    queryFn: () => apiClient.get<TransferPage>(`/transfers/me?${buildQueryString(filters)}`),
    placeholderData: (previous) => previous,
  });
}

export type ExportTransfersFilters = Pick<TransferListQuery, 'status' | 'from' | 'to'>;

async function fetchTransfersExport(filters: ExportTransfersFilters): Promise<Blob> {
  const res = await fetch(`${BASE_URL}/transfers/export?${buildQueryString(filters)}`, {
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
    chunks.push(new Uint8Array(chunk.value));
  }

  return new Blob(chunks, { type: 'text/csv' });
}

export function useExportMyTransfers() {
  return useMutation({
    mutationFn: (filters: ExportTransfersFilters) =>
      fetchTransfersExport(filters).then((blob) => downloadCsv('transfers.csv', blob)),
  });
}