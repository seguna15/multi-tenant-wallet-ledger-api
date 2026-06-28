import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/api/api-client';
import type { TenantProfile, TenantStats } from '@ledger/types';

export type { TenantProfile };
export type Tenant = TenantProfile;

// Backend needs: GET /admin/tenants  (JwtAuthGuard + RolesGuard(SYSTEM_ADMIN))
export function useAllTenants() {
  return useQuery({
    queryKey: ['admin', 'tenants'],
    queryFn: () => apiClient.get<Tenant[]>('/admin/tenants'),
  });
}

// Backend needs: GET /admin/tenants/:id
export function useTenant(id: string) {
  return useQuery({
    queryKey: ['admin', 'tenants', id],
    queryFn: () => apiClient.get<Tenant>(`/admin/tenants/${id}`),
    enabled: !!id,
  });
}

// Backend needs: PATCH /admin/tenants/:id/activate  (JWT + SYSTEM_ADMIN, replaces AdminKeyGuard)
export function useToggleTenantActivation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient.patch<Tenant>(`/admin/tenants/${id}/activate`),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'tenants'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'tenants', id] });
    },
  });
}

// Backend needs: POST /admin/tenants  (JWT + SYSTEM_ADMIN, replaces AdminKeyGuard)
export function useCreateTenant() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: { name: string; webhookUrl?: string }) =>
      apiClient.post<{ tenant: Tenant; apiKey: string }>('/admin/tenants', body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'tenants'] }),
  });
}


// Backend needs: GET /admin/tenants/:id/stats (SYSTEM_ADMIN) — aggregate wallet/user/
// transfer/DLQ counts for the tenant. Not yet implemented in AdminController.
export function useTenantStats(id: string) {
  return useQuery({
    queryKey: ['admin', 'tenants', id, 'stats'],
    queryFn: () => apiClient.get<TenantStats>(`/admin/tenants/${id}/stats`),
    enabled: !!id,
  });
}