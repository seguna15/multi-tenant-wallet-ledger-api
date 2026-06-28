import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/api/api-client';
import { buildQueryString } from '@ledger/utils';

export type DlqReason = 'MALFORMED_MESSAGE' | 'MAX_RETRIES_EXHAUSTED';

export interface DlqEvent {
  id: string;
  queue: string;
  exchange: string;
  routingKey: string;
  payload: unknown;
  headers: Record<string, unknown>;
  correlationId: string | null;
  tenantId: string | null;
  reason: DlqReason;
  replayedAt: string | null;
  replayedBy: string | null;
  createdAt: string;
}

export interface DlqEventPage {
  items: DlqEvent[];
  nextCursor: string | null;
}

export interface DlqEventListQuery {
  queue?: string;
  unresolved?: boolean;
  cursor?: string;
  limit?: number;
}

// Backend: GET /admin/dlq/events (AdminJwtAuthGuard + RolesGuard(SYSTEM_ADMIN, TENANT_ADMIN))
export function useDlqEvents(filters: DlqEventListQuery) {
  return useQuery({
    queryKey: ['admin', 'dlq', 'events', filters],
    queryFn: () => apiClient.get<DlqEventPage>(`/admin/dlq/events?${buildQueryString(filters)}`),
    placeholderData: (previous) => previous,
  });
}

// Backend: POST /admin/dlq/events/:id/replay
export function useReplayDlqEvent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiClient.post<{ replayed: boolean; eventId: string; targetQueue: string }>(
        `/admin/dlq/events/${id}/replay`,
      ),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'dlq', 'events'] }),
  });
}
