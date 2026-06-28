-- DropIndex
DROP INDEX "DlqEvent_createdAt_idx";

-- DropIndex
DROP INDEX "DlqEvent_queue_idx";

-- DropIndex
DROP INDEX "DlqEvent_tenantId_idx";

-- CreateIndex
CREATE INDEX "DlqEvent_tenantId_createdAt_idx" ON "DlqEvent"("tenantId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "DlqEvent_queue_createdAt_idx" ON "DlqEvent"("queue", "createdAt");
