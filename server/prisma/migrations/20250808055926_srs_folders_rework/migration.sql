/*
  Warnings:

  - A unique constraint covering the columns `[userId,itemType,itemId]` on the table `SRSCard` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[userId,date,kind]` on the table `SrsFolder` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[folderId,vocabId]` on the table `SrsFolderItem` will be added. If there are existing duplicate values, this will fail.

*/
-- DropForeignKey
ALTER TABLE `srsfolder` DROP FOREIGN KEY `SrsFolder_userId_fkey`;

-- DropIndex
DROP INDEX `SrsFolder_userId_date_kind_scheduledOffset_key` ON `srsfolder`;

-- AlterTable
ALTER TABLE `srsfolderitem` ADD COLUMN `vocabId` INTEGER NULL;

-- CreateIndex
CREATE UNIQUE INDEX `SRSCard_userId_itemType_itemId_key` ON `SRSCard`(`userId`, `itemType`, `itemId`);

-- CreateIndex
CREATE UNIQUE INDEX `SrsFolder_userId_date_kind_key` ON `SrsFolder`(`userId`, `date`, `kind`);

-- CreateIndex
CREATE INDEX `SrsFolderItem_folderId_learned_idx` ON `SrsFolderItem`(`folderId`, `learned`);

-- CreateIndex
CREATE UNIQUE INDEX `SrsFolderItem_folderId_vocabId_key` ON `SrsFolderItem`(`folderId`, `vocabId`);

-- AddForeignKey


-- AddForeignKey
ALTER TABLE `SrsFolderItem` ADD CONSTRAINT `SrsFolderItem_vocabId_fkey` FOREIGN KEY (`vocabId`) REFERENCES `Vocab`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
