import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/api/api-client';

export interface JournalEntry {
  id: string;
  walletId: string;
  type: 'DEBIT' | 'CREDIT';
  amount: string;
  transferId: string;
  createdAt: string;
}

export interface JournalPage {
  items: JournalEntry[];
  nextCursor: string | null;
}

export interface LedgerBalance {
  walletId: string;
  balance: number;
  currency: string;
}

export function useJournalEntries(walletId: string) {
  return useQuery({
    queryKey: ['ledger', walletId],
    queryFn: () => apiClient.get<JournalPage>(`/ledger/${walletId}`),
    enabled: !!walletId,
  });
}

export function useLedgerBalance(walletId: string) {
  return useQuery({
    queryKey: ['ledger', walletId, 'balance'],
    queryFn: () => apiClient.get<LedgerBalance>(`/ledger/${walletId}/balance`),
    enabled: !!walletId,
  });
}
