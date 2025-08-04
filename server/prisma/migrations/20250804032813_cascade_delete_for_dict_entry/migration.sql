-- DropForeignKey
ALTER TABLE `dictentry` DROP FOREIGN KEY `DictEntry_vocabId_fkey`;

-- AddForeignKey
ALTER TABLE `DictEntry` ADD CONSTRAINT `DictEntry_vocabId_fkey` FOREIGN KEY (`vocabId`) REFERENCES `Vocab`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
