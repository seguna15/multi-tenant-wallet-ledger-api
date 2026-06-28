import 'dotenv/config';
import { PrismaClient } from '@prisma-client';
import { PrismaPg } from '@prisma/adapter-pg';
import {
  generateAccountNumber,
  isUniqueConstraintViolation,
} from '@common/utils/account-number.utils';

const MAX_ATTEMPTS = 5;
const LEGACY_PREFIX = 'LEGACY-';

const adapter = new PrismaPg({ connectionString: process.env.DB_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  const wallets = await prisma.wallet.findMany({
    where: { accountNumber: { startsWith: LEGACY_PREFIX } },
    select: { id: true, tenantId: true, accountNumber: true },
  });

  if (wallets.length === 0) {
    console.log('No legacy account numbers found. Nothing to do.');
    return;
  }

  console.log(`Found ${wallets.length} wallet(s) with legacy account numbers.`);
  console.log('─'.repeat(60));

  let updated = 0;
  let failed = 0;

  for (const wallet of wallets) {
    let success = false;

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      const accountNumber = generateAccountNumber(wallet.tenantId);
      try {
        await prisma.wallet.update({
          where: { id: wallet.id },
          data: { accountNumber },
        });
        console.log(`[OK]  ${wallet.id}  ${wallet.accountNumber} → ${accountNumber}`);
        updated++;
        success = true;
        break;
      } catch (err) {
        if (isUniqueConstraintViolation(err, 'accountNumber')) {
          console.warn(`      Collision on attempt ${attempt}, retrying…`);
          continue;
        }
        console.error(`[ERR] ${wallet.id}  unexpected error:`, (err as Error).message);
        failed++;
        success = true; // stop retrying on non-collision errors
        break;
      }
    }

    if (!success) {
      console.error(`[ERR] ${wallet.id}  could not generate unique account number after ${MAX_ATTEMPTS} attempts`);
      failed++;
    }
  }

  console.log('─'.repeat(60));
  console.log(`Done — updated: ${updated}, failed: ${failed}`);

  if (failed > 0) process.exit(1);
}

main()
  .catch((e) => {
    console.error('Backfill failed:', e.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
