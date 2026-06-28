'use client';

import { useRouter } from 'next/navigation';
import { LogoutButton as BaseLogoutButton } from '@ledger/ui';
import { apiClient } from '@/api/api-client';

export function LogoutButton() {
  const router = useRouter();

  async function onLogout() {
    await apiClient.post('/auth/logout').catch(() => {});
    document.cookie = 'user_role=; path=/; Max-Age=0';
    router.replace('/login');
  }

  return <BaseLogoutButton onLogout={onLogout} className="border-r-2" />;
}
