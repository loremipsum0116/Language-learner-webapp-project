/*
  Warnings:

  - You are about to drop the `dictentry` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE `dictentry` DROP FOREIGN KEY `DictEntry_vocabId_fkey`;

-- DropTable
DROP TABLE `dictentry`;

-- CreateTable
CREATE TABLE `DictEntry` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `vocabId` INTEGER NOT NULL,
    `ipa` VARCHAR(191) NULL,
    `audioUrl` VARCHAR(191) NULL,
    `audioLocal` VARCHAR(191) NULL,
    `license` VARCHAR(191) NULL,
    `attribution` VARCHAR(191) NULL,
    `sourceUrl` VARCHAR(191) NULL,
    `retrievedAt` DATETIME(3) NULL,
    `examples` JSON NOT NULL,
    `ipaKo` VARCHAR(191) NULL,

    UNIQUE INDEX `DictEntry_vocabId_key`(`vocabId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `DictEntry` ADD CONSTRAINT `DictEntry_vocabId_fkey` FOREIGN KEY (`vocabId`) REFERENCES `Vocab`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
