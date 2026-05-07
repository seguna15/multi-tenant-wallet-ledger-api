import { Currency } from "@prisma-client";

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