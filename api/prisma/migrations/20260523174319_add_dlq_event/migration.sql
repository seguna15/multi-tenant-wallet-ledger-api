-- CreateEnum
CREATE TYPE "DlqReason" AS ENUM ('MALFORMED_MESSAGE', 'MAX_RETRIES_EXHAUSTED');

-- CreateTable
CREATE TABLE "DlqEvent" (
    "id" TEXT NOT NULL,
    "queue" TEXT NOT NULL,
    "exchange" TEXT NOT NULL,
    "routingKey" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "headers" JSONB NOT NULL,
    "correlationId" TEXT,
    "tenantId" TEXT,
    "reason" "DlqReason" NOT NULL,
    "replayedAt" TIMESTAMP(3),
    "replayedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DlqEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DlqEvent_queue_idx" ON "DlqEvent"("queue");

-- CreateIndex
CREATE INDEX "DlqEvent_tenantId_idx" ON "DlqEvent"("tenantId");

-- CreateIndex
CREATE INDEX "DlqEvent_correlationId_idx" ON "DlqEvent"("correlationId");

-- CreateIndex
CREATE INDEX "DlqEvent_createdAt_idx" ON "DlqEvent"("createdAt");

-- CreateIndex
CREATE INDEX "DlqEvent_queue_replayedAt_idx" ON "DlqEvent"("queue", "replayedAt");
