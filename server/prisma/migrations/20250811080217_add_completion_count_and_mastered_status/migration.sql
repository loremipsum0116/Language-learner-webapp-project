-- AlterTable
ALTER TABLE `srsfolder` ADD COLUMN `completionCount` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `isMastered` BOOLEAN NOT NULL DEFAULT false;
