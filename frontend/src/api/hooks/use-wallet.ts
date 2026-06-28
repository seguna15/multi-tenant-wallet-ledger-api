import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/api/api-client';
import type { Wallet, WalletPage, WalletBalance } from '@ledger/types';
export type { Wallet, WalletPage, WalletBalance } from '@ledger/types';



export function useWallet(walletId: string) {
  return useQuery({
    queryKey: ['wallets', walletId],
    queryFn: () => apiClient.get<Wallet>(`/wallets/${walletId}`),
    enabled: !!walletId,
  });
}

export function useMyWallets() {
  return useQuery({
    queryKey: ['wallets', 'me'],
    queryFn: () => apiClient.get<WalletPage>('/wallets/me'),
  });
}

export function useWalletBalance(walletId: string, enabled = true) {
  return useQuery({
    queryKey: ['wallets', walletId, 'balance'],
    queryFn: () => apiClient.get<WalletBalance>(`/wallets/${walletId}/balance`),
    enabled: enabled && !!walletId,
    staleTime: 15 * 1000, // balance is time-sensitive — override global 60s
  });
}

export function useCreateWallet() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (currency: string) => apiClient.post<Wallet>('/wallets', { currency }),

    onMutate: async (currency) => {
      await queryClient.cancelQueries({ queryKey: ['wallets', 'me'] });
      const snapshot = queryClient.getQueryData<WalletPage>(['wallets', 'me']);

      queryClient.setQueryData<WalletPage>(['wallets', 'me'], (prev) => {
        const optimistic: Wallet = {
          id: `optimistic-${Date.now()}`,
          accountNumber: '••••••••••••••',
          currency,
          isActive: true,
          userId: '',
          tenantId: '',
          createdAt: new Date().toISOString(),
        };
        return {
          items: [optimistic, ...(prev?.items ?? [])],
          nextCursor: prev?.nextCursor ?? null,
        };
      });

      return { snapshot };
    },

    onError: (_err, _vars, ctx) => {
      if (ctx?.snapshot) {
        queryClient.setQueryData(['wallets', 'me'], ctx.snapshot);
      }
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['wallets', 'me'] });
    },
  });
}