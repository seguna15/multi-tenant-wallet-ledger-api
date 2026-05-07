import 'dotenv/config';
import { PrismaClient, TransferStatus, JournalEntryType } from '@prisma-client';
import { PrismaPg } from '@prisma/adapter-pg';

const SYSTEM_WALLET_ID = '00000000-0000-0000-0000-000000000001';

const CURRENCY_DECIMALS: Record<string, number> = {
  USD: 2, EUR: 2, GBP: 2, NGN: 2, AUD: 2, CAD: 2, CNY: 2, JPY: 0,
};

function toSmallestUnit(amount: number, currency: string): bigint {
  const decimals = CURRENCY_DECIMALS[currency];
  if (decimals === undefined) throw new Error(`No decimal config for currency: ${currency}`);
  return BigInt(Math.round(amount * 10 ** decimals));
}

const adapter = new PrismaPg({ connectionString: process.env.DB_URL! });
const prisma = new PrismaClient({ adapter });

/**
 * Seeds a top-up using double-entry bookkeeping:
 *   DEBIT  system wallet  (represents issued/owed funds)
 *   CREDIT target wallet  (spendable funds credited to user)
 */
async function topUp(
  userWalletId: string,
  tenantId: string,
  currency: string,
  amount: bigint,
) {
  return prisma.$transaction(async (tx) => {
    const transfer = await tx.transfer.create({
      data: {
        tenantId,
        walletFromId: SYSTEM_WALLET_ID,
        walletToId: userWalletId,
        fromAmount: amount,
        toAmount: amount,
        fromCurrency: currency as any,
        toCurrency: currency as any,
        fxRate: '1',
        status: TransferStatus.COMPLETED,
      },
    });

    await tx.journalEntry.createMany({
      data: [
        {
          tenantId,
          walletId: SYSTEM_WALLET_ID,
          transferId: transfer.id,
          type: JournalEntryType.DEBIT,
          amount,
          currency: currency as any,
        },
        {
          tenantId,
          walletId: userWalletId,
          transferId: transfer.id,
          type: JournalEntryType.CREDIT,
          amount,
          currency: currency as any,
        },
      ],
    });

    return transfer;
  });
}

function parseArgs(argv: string[]): Record<string, string> {
  const result: Record<string, string> = {};
  for (const arg of argv.slice(2)) {
    const match = arg.match(/^--?([^=]+)=(.+)$/);
    if (match) result[match[1].toLowerCase()] = match[2];
  }
  return result;
}

async function main() {
  const args = parseArgs(process.argv);
  const walletId = args['walletid'];
  const rawAmount = args['amount'];

  if (!walletId || !rawAmount) {
    console.error('Usage:  pnpm topup --walletid=<walletId> amount=<amount>');
    console.error(`Example: pnpm topup --walletid=${walletId} amount=${rawAmount}`);
    process.exit(1);
  }

  const displayAmount = parseFloat(rawAmount);
  if (isNaN(displayAmount) || displayAmount <= 0) {
    console.error(`Invalid amount "${rawAmount}". Must be a positive number.`);
    process.exit(1);
  }

  const wallet = await prisma.wallet.findUnique({ where: { id: walletId } });
  if (!wallet) {
    console.error(`Wallet not found: ${walletId}`);
    process.exit(1);
  }
  if (!wallet.isActive) {
    console.error(`Wallet is inactive: ${walletId}`);
    process.exit(1);
  }

  const currency = wallet.currency as string;
  const amount = toSmallestUnit(displayAmount, currency);
  const decimals = CURRENCY_DECIMALS[currency];

  console.log('─'.repeat(60));
  console.log(`Wallet   : ${walletId}`);
  console.log(`Currency : ${currency} (${decimals} decimal places)`);
  console.log(`Amount   : ${displayAmount} ${currency}  →  ${amount} (smallest unit)`);
  console.log('─'.repeat(60));

  const transfer = await topUp(walletId, wallet.tenantId, currency, amount);

  console.log(`Transfer : ${transfer.id}`);
  console.log(`  DEBIT  system wallet  ${SYSTEM_WALLET_ID}`);
  console.log(`  CREDIT target wallet  ${walletId}`);
  console.log('Done.');
}

main()
  .catch((e) => {
    console.error('Top-up failed:', e.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
