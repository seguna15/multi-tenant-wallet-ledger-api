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

export interface TenantStats {
  walletCount: number;
  userCount: number;
  transferCount30d: number;
  unresolvedFailedEvents: number;
}
