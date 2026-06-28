-- DropIndex
DROP INDEX "Transfer_tenantId_idx";

-- DropIndex
DROP INDEX "Transfer_tenantId_status_idx";

-- DropIndex
DROP INDEX "Wallet_tenantId_idx";

-- CreateIndex
CREATE INDEX "Transfer_tenantId_createdAt_idx" ON "Transfer"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "Transfer_tenantId_status_createdAt_idx" ON "Transfer"("tenantId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "Transfer_walletFromId_createdAt_idx" ON "Transfer"("walletFromId", "createdAt");

-- CreateIndex
CREATE INDEX "Transfer_walletToId_createdAt_idx" ON "Transfer"("walletToId", "createdAt");
