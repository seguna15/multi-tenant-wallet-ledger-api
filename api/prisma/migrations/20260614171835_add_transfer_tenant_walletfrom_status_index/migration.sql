-- CreateIndex
CREATE INDEX "Transfer_tenantId_walletFromId_status_idx" ON "Transfer"("tenantId", "walletFromId", "status");
