/*
  Warnings:

  - A unique constraint covering the columns `[lemma]` on the table `Vocab` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE `dictentry` ADD COLUMN `retrievedAt` DATETIME(3) NULL,
    ADD COLUMN `sourceUrl` VARCHAR(191) NULL;

-- CreateIndex
CREATE UNIQUE INDEX `Vocab_lemma_key` ON `Vocab`(`lemma`);
