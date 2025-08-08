/*
  Warnings:

  - A unique constraint covering the columns `[parentId,name]` on the table `SrsFolder` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE `srsfolder` ADD COLUMN `parentId` INTEGER NULL;

-- CreateIndex
CREATE UNIQUE INDEX `SrsFolder_parentId_name_key` ON `SrsFolder`(`parentId`, `name`);

-- AddForeignKey
ALTER TABLE `SrsFolder` ADD CONSTRAINT `SrsFolder_parentId_fkey` FOREIGN KEY (`parentId`) REFERENCES `SrsFolder`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
