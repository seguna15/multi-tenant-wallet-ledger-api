import "dotenv/config";
import {PrismaClient, Currency} from "@prisma/client";
import {PrismaPg} from "@prisma/adapter-pg";
import * as argon2 from "argon2";
import * as crypto from "crypto";
import { encrypt } from "@shared/utils/encryption";
import { generateApiKey, hashApiKey } from "@shared/utils/api-key.util";

const adapter = new PrismaPg({ connectionString: process.env.DB_URL!});
const prisma = new PrismaClient({ adapter });

async function main() {
    console.log("Seeding database...");

    //generate a raw API key  - this is the only time we will have access to the raw key, so we need to save it somewhere secure
    const rawApiKey = generateApiKey();
    const apiKeyHash = await hashApiKey(rawApiKey);
    const webhookSecret = crypto.randomBytes(32).toString("hex");

    const tenant = await prisma.tenant.create({
      data: {
        name: 'Test Tenant',
        apiKeyHash,
        apiKeyExpiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year from now
        webhookUrl: 'http://localhost:3000/webhook',
        webhookSecret: encrypt(webhookSecret),
        isActive: true,
      },
    });

    console.log(`Tenant created with ${tenant.name}  and ${tenant.id}`);
    const maksedKey = `${rawApiKey.slice(0, 12)}...${rawApiKey.slice(-4)}`;
    console.log(`API Key (save this, it will not be shown again): ${rawApiKey}`);
    console.log(`Masked API Key: ${maksedKey}`);
    console.log(`Webhook Secret (save this, it will not be shown again): ${webhookSecret}`);

    const passwordHash = await argon2.hash("password123");

    const user = await prisma.user.create({
        data: {
            tenantId: tenant.id,
            email: "test_user@example.com",
            passwordHash,
        }
    }); 

    console.log(`User created with email ${user.email} and id ${user.id}`);

    const wallet = await prisma.wallet.create({
        data: {
            tenantId: tenant.id,
            userId: user.id,
            currency: Currency.GBP,
            isActive: true,
        }
    });


    console.log(`Wallet created with name ${wallet.currency} and id ${wallet.id}`);
    console.log("Database seeding completed.");
}

main()
    .catch((e) => {
        console.error("Error seeding database:", e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });