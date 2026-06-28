/*
  Warnings:

  - A unique constraint covering the columns `[accountNumber]` on the table `Wallet` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `accountNumber` to the `Wallet` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
-- Add the column as nullable first
ALTER TABLE "Wallet" ADD COLUMN "accountNumber" TEXT;

-- Backfill existing rows with a unique placeholder
UPDATE "Wallet"
SET "accountNumber" = 'LEGACY-' || id
WHERE "accountNumber" IS NULL;

-- Now apply the NOT NULL constraint
ALTER TABLE "Wallet" ALTER COLUMN "accountNumber" SET NOT NULL;

-- If you have a unique constraint on it, add that last
ALTER TABLE "Wallet" ADD CONSTRAINT "Wallet_accountNumber_key" UNIQUE ("accountNumber");
