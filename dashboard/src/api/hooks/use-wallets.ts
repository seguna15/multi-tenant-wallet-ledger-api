import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/api/api-client';
import { buildQueryString } from '@ledger/utils';
import type { WalletListQuery, WalletPage } from '@ledger/types';

export type { Wallet, WalletPage, WalletListQuery } from '@ledger/types';

// Backend: GET /admin/wallets (AdminJwtAuthGuard + RolesGuard(TENANT_ADMIN))
export function useTenantWallets(filters: WalletListQuery) {
  return useQuery({
    queryKey: ['admin', 'wallets', filters],
    queryFn: () => apiClient.get<WalletPage>(`/admin/wallets?${buildQueryString(filters)}`),
    placeholderData: (previous) => previous,
  });
}
