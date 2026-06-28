export interface Wallet {
  id: string;
  accountNumber: string;
  currency: string;
  isActive: boolean;
  userId: string;
  tenantId: string;
  createdAt: string;
}

export interface WalletPage {
  items: Wallet[];
  nextCursor: string | null;
}

export type WalletStatus = "ACTIVE" | "INACTIVE";

export const WALLET_STATUSES: WalletStatus[] = ["ACTIVE", "INACTIVE"];

export const ALL_WALLET_STATUSES = "ALL" as const;

export type WalletStatusFilter = WalletStatus | typeof ALL_WALLET_STATUSES;

export const WALLET_STATUS_LABELS: Record<WalletStatus, string> = {
  ACTIVE: "Active",
  INACTIVE: "Inactive",
};

export const WALLET_STATUS_IS_ACTIVE: Record<WalletStatus, boolean> = {
  ACTIVE: true,
  INACTIVE: false,
};

export interface WalletListQuery {
  /** TENANT_ADMIN only — narrow to a specific wallet by account number */
  accountNumber?: string;
  currency?: string;
  isActive?: boolean;
  from?: string;
  to?: string;
  cursor?: string;
  limit?: number;
}

export interface WalletBalance {
  walletId: string;
  balance: number;
  currency: string;
  cached?: boolean;
}
