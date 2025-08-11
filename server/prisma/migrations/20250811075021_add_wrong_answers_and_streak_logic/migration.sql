-- AlterTable
ALTER TABLE `srsfolder` ADD COLUMN `completedWordsCount` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `isCompleted` BOOLEAN NOT NULL DEFAULT false,
    MODIFY `kind` VARCHAR(191) NOT NULL DEFAULT 'manual';

-- AlterTable
ALTER TABLE `user` ADD COLUMN `dailyQuizCount` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `lastQuizDate` DATETIME(3) NULL,
    ADD COLUMN `streakUpdatedAt` DATETIME(3) NULL;

-- CreateTable
CREATE TABLE `WrongAnswer` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` INTEGER NOT NULL,
    `vocabId` INTEGER NOT NULL,
    `wrongAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `reviewWindowStart` DATETIME(3) NOT NULL,
    `reviewWindowEnd` DATETIME(3) NOT NULL,
    `reviewedAt` DATETIME(3) NULL,
    `isCompleted` BOOLEAN NOT NULL DEFAULT false,
    `attempts` INTEGER NOT NULL DEFAULT 0,

    INDEX `WrongAnswer_userId_isCompleted_idx`(`userId`, `isCompleted`),
    INDEX `WrongAnswer_reviewWindowStart_reviewWindowEnd_idx`(`reviewWindowStart`, `reviewWindowEnd`),
    UNIQUE INDEX `WrongAnswer_userId_vocabId_wrongAt_key`(`userId`, `vocabId`, `wrongAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `WrongAnswer` ADD CONSTRAINT `WrongAnswer_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `WrongAnswer` ADD CONSTRAINT `WrongAnswer_vocabId_fkey` FOREIGN KEY (`vocabId`) REFERENCES `Vocab`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
