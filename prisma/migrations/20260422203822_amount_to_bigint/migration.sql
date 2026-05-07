/*
  Warnings:

  - You are about to alter the column `amount` on the `JournalEntry` table. The data in that column could be lost. The data in that column will be cast from `Decimal(18,8)` to `BigInt`.
  - You are about to drop the column `amount` on the `Transfer` table. All the data in the column will be lost.
  - You are about to drop the column `currency` on the `Transfer` table. All the data in the column will be lost.
  - Added the required column `fromAmount` to the `Transfer` table without a default value. This is not possible if the table is not empty.
  - Added the required column `fromCurrency` to the `Transfer` table without a default value. This is not possible if the table is not empty.
  - Added the required column `toAmount` to the `Transfer` table without a default value. This is not possible if the table is not empty.
  - Added the required column `toCurrency` to the `Transfer` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "JournalEntry" ALTER COLUMN "amount" SET DATA TYPE BIGINT;

-- AlterTable
ALTER TABLE "Transfer" DROP COLUMN "amount",
DROP COLUMN "currency",
ADD COLUMN     "fromAmount" BIGINT NOT NULL,
ADD COLUMN     "fromCurrency" "Currency" NOT NULL,
ADD COLUMN     "toAmount" BIGINT NOT NULL,
ADD COLUMN     "toCurrency" "Currency" NOT NULL;
