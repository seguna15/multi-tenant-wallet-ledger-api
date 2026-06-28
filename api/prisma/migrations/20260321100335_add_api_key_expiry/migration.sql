-- AlterTable
ALTER TABLE "Tenant" ADD COLUMN     "apiKeyExpiresAt" TIMESTAMP(3),
ADD COLUMN     "apiKeyLastUsedAt" TIMESTAMP(3);
