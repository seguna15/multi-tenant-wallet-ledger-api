'use client';

export type UserRole = 'SYSTEM_ADMIN' | 'TENANT_ADMIN' | 'CUSTOMER';

export interface CurrentUser {
  sub: string;
  email: string;
  tenantId: string;
  role: UserRole;
}

export function useCurrentUser(): CurrentUser | null {
  if (typeof window === 'undefined') return null;
  const match = document.cookie.match(/(?:^|;\s*)user_role=([^;]+)/);
  if (!match) return null;
  return { role: match[1] as UserRole } as CurrentUser;
}
