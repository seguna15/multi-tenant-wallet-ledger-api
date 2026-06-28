export type TransferStatus =
  | "INITIATED"
  | "PROCESSING"
  | "COMPLETED"
  | "FAILED";

export const TRANSFER_STATUSES: TransferStatus[] = [
  "INITIATED",
  "PROCESSING",
  "COMPLETED",
  "FAILED"
];

export const ALL_STATUSES = "ALL" as const;

export type StatusFilter = TransferStatus | typeof ALL_STATUSES;

export const TRANSFER_STATUS_LABELS: Record<TransferStatus, string> = {
  INITIATED: "Initiated",
  PROCESSING: "Processing",
  COMPLETED: "Completed",
  FAILED: "Failed",
};

export const TRANSFER_STATUS_BADGE_VARIANT: Record<
  TransferStatus,
  "default" | "secondary" | "success" | "destructive" 
> = {
  INITIATED: "secondary",
  PROCESSING: "default",
  COMPLETED: "success",
  FAILED: "destructive"
};

export interface TransferWalletRef {
  id: string;
  currency: string;
  accountNumber: string;
}

export interface Transfer {
  id: string;
  tenantId: string;
  walletFromId: string;
  walletToId: string;
  /** BigInt serialized as string — convert via BigInt(fromAmount) before arithmetic */
  fromAmount: string;
  toAmount: string;
  fromCurrency: string;
  toCurrency: string;
  fxRate: string;
  status: TransferStatus;
  idempotencyKey: string | null;
  createdAt: string;
  updatedAt: string;
  walletFrom: TransferWalletRef;
  walletTo: TransferWalletRef;
}

export interface ResolvedWallet {
  walletId: string;
  accountNumber: string;
  currency: string;
}

export interface TransferListQuery {
  status?: TransferStatus;
  from?: string;
  to?: string;
  /** TENANT_ADMIN only — narrow to transfers involving this account number */
  accountNumber?: string;
  cursor?: string;
  limit?: number;
}

export interface TransferPage {
  items: Transfer[];
  nextCursor: string | null;
}
