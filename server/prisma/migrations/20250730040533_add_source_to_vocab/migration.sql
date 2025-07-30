-- AlterTable
ALTER TABLE `vocab` ADD COLUMN `source` VARCHAR(191) NULL;

-- CreateIndex
CREATE INDEX `Vocab_source_idx` ON `Vocab`(`source`);
