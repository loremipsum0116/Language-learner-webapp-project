/*
  Warnings:

  - A unique constraint covering the columns `[userId,itemId,itemType]` on the table `SRSCard` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE `category` ADD COLUMN `alarmActive` BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN `kind` VARCHAR(191) NOT NULL DEFAULT 'wordbook',
    ADD COLUMN `nextAlarmAt` DATETIME(3) NULL,
    ADD COLUMN `remindEvery` INTEGER NULL;

-- AlterTable
ALTER TABLE `srscard` ADD COLUMN `active` BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN `categoryId` INTEGER NULL;

-- CreateTable
CREATE TABLE `SessionBatch` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `order` INTEGER NOT NULL,
    `cards` JSON NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE UNIQUE INDEX `SRSCard_userId_itemId_itemType_key` ON `SRSCard`(`userId`, `itemId`, `itemType`);

-- AddForeignKey
ALTER TABLE `SRSCard` ADD CONSTRAINT `SRSCard_categoryId_fkey` FOREIGN KEY (`categoryId`) REFERENCES `Category`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
