-- AlterTable
ALTER TABLE `srscard` ADD COLUMN `isOverdue` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `overdueDeadline` DATETIME(3) NULL;
