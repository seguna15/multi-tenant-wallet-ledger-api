import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/api/api-client';

export interface TenantProfile {
  id: string;
  name: string;
  type: string;
  isActive: boolean;
  webhookUrl: string | null;
  createdAt: string;
}

export interface ApiKeyMetadata {
  lastUsedAt: string | null;
  expiresAt: string | null;
}

export function useMyTenant() {
  return useQuery({
    queryKey: ['tenant', 'me'],
    queryFn: () => apiClient.get<TenantProfile>('/tenants/me'),
  });
}

export function useApiKeyMetadata() {
  return useQuery({
    queryKey: ['tenant', 'api-key'],
    queryFn: () => apiClient.get<ApiKeyMetadata>('/tenants/me/api-key'),
  });
}

export function useRotateApiKey() {
  return useMutation({
    mutationFn: () => apiClient.post<{ apiKey: string }>('/tenants/rotate-api-key'),
  });
}

export function useRotateWebhookSecret() {
  return useMutation({
    mutationFn: () => apiClient.post<{ webhookSecret: string }>('/tenants/rotate-webhook-secret'),
  });
}

export function useUpdateTenant() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: { name?: string; webhookUrl?: string }) =>
      apiClient.patch<TenantProfile>('/tenants', body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tenant', 'me'] }),
  });
}
