import 'dotenv/config';
import { PrismaClient, UserRole } from '@prisma-client';
import { PrismaPg } from '@prisma/adapter-pg';
import * as argon2 from 'argon2';

const adapter = new PrismaPg({ connectionString: process.env.DB_URL! });
const prisma = new PrismaClient({ adapter });

const VALID_ROLES = Object.values(UserRole) as string[];

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
  const email = args['email'];
  const password = args['password'];
  const role = args['role']?.toUpperCase();

  if (!tenantId || !email || !password || !role) {
    console.error(
      'Usage: pnpm create-user --tenantid=<id> --email=<email> --password=<password> --role=<role>',
    );
    console.error(`  Available roles: ${VALID_ROLES.join(', ')}`);
    console.error(
      '  Example: pnpm create-user --tenantid=abc-123 --email=admin@acme.com --password=Secret123! --role=TENANT_ADMIN',
    );
    process.exit(1);
  }

  if (!VALID_ROLES.includes(role)) {
    console.error(`Invalid role "${role}". Must be one of: ${VALID_ROLES.join(', ')}`);
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

  const existing = await prisma.user.findUnique({
    where: { tenantId_email: { tenantId, email } },
  });
  if (existing) {
    console.error(`User already exists: ${email} on tenant ${tenant.name}`);
    process.exit(1);
  }

  const passwordHash = await argon2.hash(password);

  const user = await prisma.user.create({
    data: {
      tenantId,
      email,
      passwordHash,
      role: role as UserRole,
    },
  });

  console.log('─'.repeat(60));
  console.log(`Tenant  : ${tenant.name} (${tenant.id})`);
  console.log(`User ID : ${user.id}`);
  console.log(`Email   : ${user.email}`);
  console.log(`Role    : ${user.role}`);
  console.log(`Active  : ${user.isActive}`);
  console.log('─'.repeat(60));
  console.log('User created successfully.');
}

main()
  .catch((e) => {
    console.error('Failed to create user:', e.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
