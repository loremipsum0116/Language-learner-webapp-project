-- CreateIndex
CREATE INDEX `srscard_frozenUntil_idx` ON `srscard`(`frozenUntil`);

-- AlterTable
ALTER TABLE `srscard` ADD COLUMN `frozenUntil` DATETIME(3) NULL;