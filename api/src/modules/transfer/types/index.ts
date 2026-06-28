import { Currency, JournalEntryType, TransferStatus } from '@prisma-client';

export interface CreateTransferInput {
  walletFromId: string;
  walletToId: string;
  fromAmount: bigint;
  toAmount: bigint;
  fromCurrency: Currency;
  toCurrency: Currency;
  fxRate: string;
  idempotencyKey?: string;
}

export interface TransferExportRowBase {
  date: string;
  amount: string;
  currency: Currency;
  status: TransferStatus;
}

export interface TransferExportRow extends TransferExportRowBase {
  direction: JournalEntryType;
  counterpartyAccount: string;
}

export interface TransferTenantExportRow extends TransferExportRowBase {
  fromAccount: string;
  toAccount: string;
  reference: string;
}