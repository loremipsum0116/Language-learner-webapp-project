-- DropForeignKey
ALTER TABLE `srsfolder` DROP FOREIGN KEY `SrsFolder_parentId_fkey`;

-- AddForeignKey
ALTER TABLE `SrsFolder` ADD CONSTRAINT `SrsFolder_parentId_fkey` FOREIGN KEY (`parentId`) REFERENCES `SrsFolder`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
