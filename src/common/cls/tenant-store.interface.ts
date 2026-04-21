import { ClsStore } from "nestjs-cls";

export interface TenantStore extends ClsStore {
  tenantId: string;
  userId?: string; // present only on JWT authenticated requests
  isGlobalAdmin: boolean; // bypasses tenant scoping for internan/webhook paths
  correlationId: string;
}