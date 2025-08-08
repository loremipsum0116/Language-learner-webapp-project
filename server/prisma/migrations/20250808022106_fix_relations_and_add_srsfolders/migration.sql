/*
  Warnings:

  - You are about to drop the column `active` on the `srscard` table. All the data in the column will be lost.
  - You are about to drop the column `correctCount` on the `srscard` table. All the data in the column will be lost.
  - You are about to drop the column `createdAt` on the `srscard` table. All the data in the column will be lost.
  - You are about to drop the column `incorrectCount` on the `srscard` table. All the data in the column will be lost.
  - You are about to drop the column `lastResult` on the `srscard` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `srscard` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE `srscard` DROP FOREIGN KEY `SRSCard_userId_fkey`;

-- DropIndex
DROP INDEX `SRSCard_userId_itemId_itemType_key` ON `srscard`;

-- DropIndex
DROP INDEX `SRSCard_userId_itemType_nextReviewAt_idx` ON `srscard`;

-- AlterTable
ALTER TABLE `srscard` DROP COLUMN `active`,
    DROP COLUMN `correctCount`,
    DROP COLUMN `createdAt`,
    DROP COLUMN `incorrectCount`,
    DROP COLUMN `lastResult`,
    DROP COLUMN `updatedAt`,
    ADD COLUMN `cohortDate` DATETIME(3) NULL,
    ADD COLUMN `correctTotal` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `wrongTotal` INTEGER NOT NULL DEFAULT 0,
    MODIFY `nextReviewAt` DATETIME(3) NULL;

-- CreateTable
CREATE TABLE `SrsFolder` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` INTEGER NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `date` DATETIME(3) NOT NULL,
    `kind` VARCHAR(191) NOT NULL DEFAULT 'review',
    `scheduledOffset` INTEGER NULL,
    `autoCreated` BOOLEAN NOT NULL DEFAULT false,
    `originSessionId` INTEGER NULL,
    `alarmActive` BOOLEAN NOT NULL DEFAULT true,
    `nextAlarmAt` DATETIME(3) NULL,
    `completedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `SrsFolder_userId_date_idx`(`userId`, `date`),
    UNIQUE INDEX `SrsFolder_userId_date_kind_scheduledOffset_key`(`userId`, `date`, `kind`, `scheduledOffset`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `DailyStudyStat` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` INTEGER NOT NULL,
    `date` DATETIME(3) NOT NULL,
    `srsSolved` INTEGER NOT NULL DEFAULT 0,
    `autoLearned` INTEGER NOT NULL DEFAULT 0,
    `wrongDueNext` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `DailyStudyStat_userId_date_key`(`userId`, `date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SrsFolderItem` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `folderId` INTEGER NOT NULL,
    `cardId` INTEGER NOT NULL,
    `learned` BOOLEAN NOT NULL DEFAULT false,
    `wrongCount` INTEGER NOT NULL DEFAULT 0,
    `lastReviewedAt` DATETIME(3) NULL,

    INDEX `SrsFolderItem_cardId_idx`(`cardId`),
    UNIQUE INDEX `SrsFolderItem_folderId_cardId_key`(`folderId`, `cardId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `SRSCard_userId_nextReviewAt_idx` ON `SRSCard`(`userId`, `nextReviewAt`);

-- AddForeignKey
ALTER TABLE `SrsFolder` ADD CONSTRAINT `SrsFolder_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SRSCard` ADD CONSTRAINT `SRSCard_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DailyStudyStat` ADD CONSTRAINT `DailyStudyStat_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SrsFolderItem` ADD CONSTRAINT `SrsFolderItem_folderId_fkey` FOREIGN KEY (`folderId`) REFERENCES `SrsFolder`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SrsFolderItem` ADD CONSTRAINT `SrsFolderItem_cardId_fkey` FOREIGN KEY (`cardId`) REFERENCES `SRSCard`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
