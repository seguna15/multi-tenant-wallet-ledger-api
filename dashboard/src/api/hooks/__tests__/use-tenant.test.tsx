// Tests for useRotateApiKey (dashboard/src/api/hooks/use-tenant.ts).
//
// The real hook is a parameterless mutation: it POSTs to
// `/tenants/rotate-api-key` with no body (rotation is scoped to the
// authenticated tenant via the request's auth cookie/header) and resolves
// with `{ apiKey: string }` — the new plaintext key, shown to the user once.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useRotateApiKey } from '../use-tenant';
import { apiClient } from '@/api/api-client';

vi.mock('@/api/api-client', () => ({
  apiClient: { post: vi.fn() },
}));

function createWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe('useRotateApiKey', () => {
  beforeEach(() => vi.clearAllMocks());

  it('rotates the API key with no request body and returns the new plaintext key', async () => {
    // apiClient.post<T> resolves with T directly (no `{ data }` wrapper).
    vi.mocked(apiClient.post).mockResolvedValue({ apiKey: 'lk_live_newGeneratedKey123456789' });

    const { result } = renderHook(() => useRotateApiKey(), { wrapper: createWrapper() });
    result.current.mutate();

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.apiKey).toBe('lk_live_newGeneratedKey123456789');
    // No tenant/key id is sent — the endpoint operates on the caller's own tenant.
    expect(apiClient.post).toHaveBeenCalledWith('/tenants/rotate-api-key');
  });

  it('surfaces an error when rotation fails', async () => {
    vi.mocked(apiClient.post).mockRejectedValue(new Error('Forbidden'));

    const { result } = renderHook(() => useRotateApiKey(), { wrapper: createWrapper() });
    result.current.mutate();

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBeInstanceOf(Error);
  });

  // Unlike a typical mutation, useRotateApiKey does not call
  // queryClient.invalidateQueries — there is no cached "api keys" list to
  // refresh, since the dashboard only ever displays key metadata
  // (last used / expiry), never the key value itself.
});
