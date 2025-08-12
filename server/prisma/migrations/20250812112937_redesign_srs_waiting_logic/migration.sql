/*
  Warnings:

  - You are about to drop the column `overdueStartAt` on the `srscard` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE `srscard` DROP COLUMN `overdueStartAt`,
    ADD COLUMN `waitingUntil` DATETIME(3) NULL;
