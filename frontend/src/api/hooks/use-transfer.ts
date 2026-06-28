import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/api/api-client';
import type { Transfer, TransferStatus, ResolvedWallet } from '@ledger/types';

export type { Transfer, TransferStatus, ResolvedWallet } from '@ledger/types';


export const TERMINAL_STATUSES = new Set<TransferStatus>(['COMPLETED', 'FAILED']);

export function useTransferStream(transferId: string) {
  const [data, setData] = useState<Transfer | null>(null);
  const [isPending, setIsPending] = useState(true);
  const [isError, setIsError] = useState(false);

  useEffect(() => {
    if (!transferId) return;

    let cancelled = false;
    let es: EventSource | undefined;
    setIsPending(true);
    setIsError(false);

    apiClient
      .get<Transfer>(`/transfers/${transferId}`)
      .then((transfer) => {
        if (cancelled) return;
        setData(transfer);
        setIsPending(false);

        if (TERMINAL_STATUSES.has(transfer.status)) return;

        es = new EventSource(`/api/transfers/${transferId}/stream`, {
          withCredentials: true,
        });

        es.onmessage = (e) => {
          const payload = JSON.parse(e.data);
          if (payload.type === 'ping') return;
          setData((prev) => (prev ? { ...prev, status: payload.status } : prev));
          if (TERMINAL_STATUSES.has(payload.status)) es?.close();
        };
      })
      .catch(() => {
        if (cancelled) return;
        setIsPending(false);
        setIsError(true);
      });

    return () => {
      cancelled = true;
      es?.close();
    };
  }, [transferId]);

  return { data, isPending, isError };
}


export function useCreateTransfer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      walletFromId,
      walletToId,
      amount,
      idempotencyKey,
    }: {
      walletFromId: string;
      walletToId: string;
      amount: number;
      idempotencyKey: string;
    }) =>
      apiClient.post<Transfer>(
        '/transfers',
        { walletFromId, walletToId, amount },
        { headers: { 'idempotency-key': idempotencyKey } },
      ),

    onSuccess: (transfer) => {
      queryClient.setQueryData(['transfers', transfer.id], transfer);
    },
  });
}

export function useResolveWallet(accountNumber: string, enabled: boolean) {
  return useQuery({
    queryKey: ['wallets', 'resolve', accountNumber],
    queryFn: () =>
      apiClient.get<ResolvedWallet>(
        `/wallets/resolve?accountNumber=${encodeURIComponent(accountNumber)}`,
      ),
    enabled: enabled && accountNumber.trim().length > 0,
    retry: false, // 404 = not found, don't spam the API
    staleTime: 30_000,
  });
}
