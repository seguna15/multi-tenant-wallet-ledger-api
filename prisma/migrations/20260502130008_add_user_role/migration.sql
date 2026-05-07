-- CreateEnum
CREATE TYPE "TenantType" AS ENUM ('SYSTEM', 'CLIENT');

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('SYSTEM_ADMIN', 'TENANT_ADMIN', 'CUSTOMER');

-- AlterTable
ALTER TABLE "Tenant" ADD COLUMN     "type" "TenantType" NOT NULL DEFAULT 'CLIENT';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "role" "UserRole" NOT NULL DEFAULT 'CUSTOMER';
