import { Currency } from "@prisma-client";

export interface WriteJournalEntriesInput {
  transferId: string;
  debitWalletId: string;
  creditWalletId: string;
  debitAmount: bigint;
  debitCurrency: Currency;
  creditAmount: bigint;
  creditCurrency: Currency;
}
