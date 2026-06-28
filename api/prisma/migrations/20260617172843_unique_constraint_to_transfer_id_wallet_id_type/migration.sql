/*
  Warnings:

  - A unique constraint covering the columns `[transferId,walletId,type]` on the table `JournalEntry` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "JournalEntry_transferId_walletId_type_key" ON "JournalEntry"("transferId", "walletId", "type");
