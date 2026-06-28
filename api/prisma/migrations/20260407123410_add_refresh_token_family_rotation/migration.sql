/*
  Warnings:

  - You are about to drop the column `revokedAt` on the `RefreshToken` table. All the data in the column will be lost.
  - Added the required column `familyId` to the `RefreshToken` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "RefreshToken" DROP COLUMN "revokedAt",
ADD COLUMN     "absoluteExpireAt" TIMESTAMP(3),
ADD COLUMN     "familyId" TEXT NOT NULL,
ADD COLUMN     "replacedByHash" TEXT,
ADD COLUMN     "revoked" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "RefreshToken_familyId_tenantId_idx" ON "RefreshToken"("familyId", "tenantId");
