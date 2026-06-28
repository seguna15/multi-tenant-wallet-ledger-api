import { useMutation } from '@tanstack/react-query';
import { apiClient } from '@/api/api-client';
import type { LoginInput } from '@ledger/utils';

export function useLogin() {
  return useMutation({
    mutationFn: (values: LoginInput) =>
      apiClient.post<void>('/auth/login', values),
  });
}
