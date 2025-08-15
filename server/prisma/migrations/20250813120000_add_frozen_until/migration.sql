-- AlterTable
ALTER TABLE `srscard` ADD COLUMN `frozenUntil` DATETIME(3) NULL;

-- CreateIndex
CREATE INDEX `srscard_frozenUntil_idx` ON `srscard`(`frozenUntil`);