-- CreateTable
CREATE TABLE `User` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `email` VARCHAR(191) NOT NULL,
    `passwordHash` VARCHAR(191) NOT NULL,
    `role` VARCHAR(191) NOT NULL DEFAULT 'USER',
    `profile` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `lastStudiedAt` DATETIME(3) NULL,
    `streak` INTEGER NOT NULL DEFAULT 0,

    UNIQUE INDEX `User_email_key`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Category` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` INTEGER NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `kind` VARCHAR(191) NOT NULL DEFAULT 'wordbook',
    `nextAlarmAt` DATETIME(3) NULL,
    `alarmActive` BOOLEAN NOT NULL DEFAULT true,
    `remindEvery` INTEGER NULL,

    UNIQUE INDEX `Category_userId_name_key`(`userId`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Vocab` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `lemma` VARCHAR(191) NOT NULL,
    `pos` VARCHAR(191) NOT NULL,
    `plural` VARCHAR(191) NULL,
    `levelCEFR` VARCHAR(191) NOT NULL,
    `freq` INTEGER NULL,
    `source` VARCHAR(191) NULL,

    UNIQUE INDEX `Vocab_lemma_key`(`lemma`),
    INDEX `Vocab_lemma_idx`(`lemma`),
    INDEX `Vocab_source_idx`(`source`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

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

-- CreateTable
CREATE TABLE `GrammarItem` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `topic` VARCHAR(191) NOT NULL,
    `rule` VARCHAR(191) NOT NULL,
    `examples` JSON NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `GrammarExercise` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `topicId` VARCHAR(191) NOT NULL,
    `topic` VARCHAR(191) NOT NULL,
    `levelCEFR` VARCHAR(191) NOT NULL,
    `items` JSON NOT NULL,

    UNIQUE INDEX `GrammarExercise_topicId_key`(`topicId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Reading` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `title` VARCHAR(191) NOT NULL,
    `body` VARCHAR(191) NOT NULL,
    `levelCEFR` VARCHAR(191) NOT NULL,
    `glosses` JSON NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SessionBatch` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `order` INTEGER NOT NULL,
    `cards` JSON NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SrsFolder` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` INTEGER NOT NULL,
    `parentId` INTEGER NULL,
    `name` VARCHAR(191) NOT NULL,
    `createdDate` DATE NOT NULL,
    `stage` INTEGER NOT NULL DEFAULT 0,
    `nextReviewDate` DATE NULL,
    `lastReviewedAt` DATETIME(3) NULL,
    `nextReviewAt` DATETIME(3) NULL,
    `alarmActive` BOOLEAN NOT NULL DEFAULT true,
    `nextAlarmAt` DATETIME(3) NULL,
    `completedAt` DATETIME(3) NULL,
    `cycleAnchorAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `kind` VARCHAR(191) NOT NULL DEFAULT 'review',
    `scheduledOffset` INTEGER NULL,
    `autoCreated` BOOLEAN NOT NULL DEFAULT false,
    `originSessionId` INTEGER NULL,
    `date` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `reminderMask` INTEGER NOT NULL DEFAULT 0,

    INDEX `SrsFolder_userId_alarmActive_nextReviewAt_idx`(`userId`, `alarmActive`, `nextReviewAt`),
    INDEX `SrsFolder_nextAlarmAt_idx`(`nextAlarmAt`),
    INDEX `SrsFolder_parentId_idx`(`parentId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SRSCard` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` INTEGER NOT NULL,
    `itemType` VARCHAR(191) NOT NULL,
    `itemId` INTEGER NOT NULL,
    `stage` INTEGER NOT NULL DEFAULT 0,
    `nextReviewAt` DATETIME(3) NULL,
    `categoryId` INTEGER NULL,
    `correctTotal` INTEGER NOT NULL DEFAULT 0,
    `wrongTotal` INTEGER NOT NULL DEFAULT 0,
    `cohortDate` DATETIME(3) NULL,

    INDEX `SRSCard_userId_nextReviewAt_idx`(`userId`, `nextReviewAt`),
    UNIQUE INDEX `SRSCard_userId_itemType_itemId_key`(`userId`, `itemType`, `itemId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `TutorLog` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` INTEGER NOT NULL,
    `mode` VARCHAR(191) NOT NULL,
    `input` VARCHAR(191) NOT NULL,
    `output` VARCHAR(191) NOT NULL,
    `tokens` INTEGER NULL,
    `cost` DOUBLE NULL,
    `refs` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `UserVocab` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` INTEGER NOT NULL,
    `vocabId` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `categoryId` INTEGER NULL,

    INDEX `UserVocab_userId_categoryId_idx`(`userId`, `categoryId`),
    UNIQUE INDEX `UserVocab_userId_vocabId_key`(`userId`, `vocabId`),
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
    `vocabId` INTEGER NULL,

    INDEX `SrsFolderItem_cardId_idx`(`cardId`),
    INDEX `SrsFolderItem_folderId_learned_idx`(`folderId`, `learned`),
    UNIQUE INDEX `SrsFolderItem_folderId_cardId_key`(`folderId`, `cardId`),
    UNIQUE INDEX `SrsFolderItem_folderId_vocabId_key`(`folderId`, `vocabId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Category` ADD CONSTRAINT `Category_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DictEntry` ADD CONSTRAINT `DictEntry_vocabId_fkey` FOREIGN KEY (`vocabId`) REFERENCES `Vocab`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SrsFolder` ADD CONSTRAINT `SrsFolder_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SRSCard` ADD CONSTRAINT `SRSCard_categoryId_fkey` FOREIGN KEY (`categoryId`) REFERENCES `Category`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SRSCard` ADD CONSTRAINT `SRSCard_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TutorLog` ADD CONSTRAINT `TutorLog_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `UserVocab` ADD CONSTRAINT `UserVocab_categoryId_fkey` FOREIGN KEY (`categoryId`) REFERENCES `Category`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `UserVocab` ADD CONSTRAINT `UserVocab_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `UserVocab` ADD CONSTRAINT `UserVocab_vocabId_fkey` FOREIGN KEY (`vocabId`) REFERENCES `Vocab`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DailyStudyStat` ADD CONSTRAINT `DailyStudyStat_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SrsFolderItem` ADD CONSTRAINT `SrsFolderItem_folderId_fkey` FOREIGN KEY (`folderId`) REFERENCES `SrsFolder`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SrsFolderItem` ADD CONSTRAINT `SrsFolderItem_cardId_fkey` FOREIGN KEY (`cardId`) REFERENCES `SRSCard`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SrsFolderItem` ADD CONSTRAINT `SrsFolderItem_vocabId_fkey` FOREIGN KEY (`vocabId`) REFERENCES `Vocab`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
