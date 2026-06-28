export type UserRole = 'SYSTEM_ADMIN' | 'TENANT_ADMIN' | 'CUSTOMER';

export interface CurrentUser {
  sub: string;
  email: string;
  tenantId: string;
  role: UserRole;
}
