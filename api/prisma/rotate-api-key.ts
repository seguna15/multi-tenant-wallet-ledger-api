import 'dotenv/config';
import { PrismaClient } from '@prisma-client';
import { PrismaPg } from '@prisma/adapter-pg';
import { generateApiKey, hashApiKey } from '@shared/utils/api-key.util';

const adapter = new PrismaPg({ connectionString: process.env.DB_URL! });
const prisma = new PrismaClient({ adapter });

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
  const tenantId = args['tenantid'];

  if (!tenantId) {
    console.error('Usage: pnpm rotate-api-key --tenantid=<id>');
    console.error('  Example: pnpm rotate-api-key --tenantid=abc-123');
    process.exit(1);
  }

  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });

  if (!tenant) {
    console.error(`Tenant not found: ${tenantId}`);
    process.exit(1);
  }

  if (!tenant.isActive) {
    console.error(`Tenant is inactive: ${tenantId} (${tenant.name})`);
    process.exit(1);
  }

  const newPlaintextApiKey = generateApiKey();
  const newApiKeyHash = await hashApiKey(newPlaintextApiKey);
  const expiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);

  await prisma.tenant.update({
    where: { id: tenantId },
    data: {
      apiKeyHash: newApiKeyHash,
      apiKeyExpiresAt: expiresAt,
      apiKeyLastUsedAt: null,
    },
  });

  const maskedKey = `${newPlaintextApiKey.slice(0, 12)}...${newPlaintextApiKey.slice(-4)}`;

  console.log('─'.repeat(60));
  console.log(`Tenant     : ${tenant.name} (${tenant.id})`);
  console.log(`Masked Key : ${maskedKey}`);
  console.log(`Expires At : ${expiresAt.toISOString()}`);
  console.log('─'.repeat(60));
  console.log(`New API Key (save this — it will NOT be shown again):`);
  console.log(newPlaintextApiKey);
  console.log('─'.repeat(60));
}

main()
  .catch((e) => {
    console.error('Failed to rotate API key:', e.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
