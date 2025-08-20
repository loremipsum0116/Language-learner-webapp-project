-- CreateTable
CREATE TABLE `category` (
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
CREATE TABLE `dailystudystat` (
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
CREATE TABLE `dictentry` (
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
CREATE TABLE `grammarexercise` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `topicId` VARCHAR(191) NOT NULL,
    `topic` VARCHAR(191) NOT NULL,
    `levelCEFR` VARCHAR(191) NOT NULL,
    `items` JSON NOT NULL,

    UNIQUE INDEX `GrammarExercise_topicId_key`(`topicId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `grammaritem` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `topic` VARCHAR(191) NOT NULL,
    `rule` VARCHAR(191) NOT NULL,
    `examples` JSON NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `reading` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `title` VARCHAR(191) NOT NULL,
    `body` VARCHAR(191) NOT NULL,
    `levelCEFR` VARCHAR(191) NOT NULL,
    `glosses` JSON NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sessionbatch` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `order` INTEGER NOT NULL,
    `cards` JSON NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `srscard` (
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
    `isOverdue` BOOLEAN NOT NULL DEFAULT false,
    `overdueDeadline` DATETIME(3) NULL,
    `isFromWrongAnswer` BOOLEAN NOT NULL DEFAULT false,
    `waitingUntil` DATETIME(3) NULL,
    `frozenUntil` DATETIME(3) NULL,
    `folderId` INTEGER NULL,
    `isMastered` BOOLEAN NOT NULL DEFAULT false,
    `masterCycles` INTEGER NOT NULL DEFAULT 0,
    `masteredAt` DATETIME(3) NULL,
    `overdueStartAt` DATETIME(3) NULL,
    `wrongStreakCount` INTEGER NOT NULL DEFAULT 0,
    `lastReviewedAt` DATETIME(3) NULL,
    `isTodayStudy` BOOLEAN NOT NULL DEFAULT false,
    `todayFirstResult` BOOLEAN NULL,
    `todayStudyDate` DATETIME(3) NULL,

    INDEX `SRSCard_categoryId_fkey`(`categoryId`),
    INDEX `SRSCard_folderId_fkey`(`folderId`),
    INDEX `SRSCard_userId_isMastered_idx`(`userId`, `isMastered`),
    INDEX `SRSCard_userId_nextReviewAt_idx`(`userId`, `nextReviewAt`),
    UNIQUE INDEX `SRSCard_userId_itemType_itemId_folderId_key`(`userId`, `itemType`, `itemId`, `folderId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `srsfolder` (
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
    `kind` VARCHAR(191) NOT NULL DEFAULT 'manual',
    `scheduledOffset` INTEGER NULL,
    `autoCreated` BOOLEAN NOT NULL DEFAULT false,
    `originSessionId` INTEGER NULL,
    `isCompleted` BOOLEAN NOT NULL DEFAULT false,
    `completedWordsCount` INTEGER NOT NULL DEFAULT 0,
    `completionCount` INTEGER NOT NULL DEFAULT 0,
    `isMastered` BOOLEAN NOT NULL DEFAULT false,
    `date` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `reminderMask` INTEGER NOT NULL DEFAULT 0,
    `learningCurveType` VARCHAR(191) NOT NULL DEFAULT 'long',
    `isFolderMastered` BOOLEAN NOT NULL DEFAULT false,
    `folderMasteredAt` DATETIME(3) NULL,

    INDEX `SrsFolder_nextAlarmAt_idx`(`nextAlarmAt`),
    INDEX `SrsFolder_parentId_idx`(`parentId`),
    INDEX `SrsFolder_userId_alarmActive_nextReviewAt_idx`(`userId`, `alarmActive`, `nextReviewAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `srsfolderitem` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `folderId` INTEGER NOT NULL,
    `cardId` INTEGER NOT NULL,
    `learned` BOOLEAN NOT NULL DEFAULT false,
    `wrongCount` INTEGER NOT NULL DEFAULT 0,
    `lastReviewedAt` DATETIME(3) NULL,
    `vocabId` INTEGER NULL,
    `lastWrongAt` DATETIME(3) NULL,

    INDEX `SrsFolderItem_cardId_idx`(`cardId`),
    INDEX `SrsFolderItem_folderId_learned_idx`(`folderId`, `learned`),
    INDEX `SrsFolderItem_vocabId_fkey`(`vocabId`),
    UNIQUE INDEX `SrsFolderItem_folderId_cardId_key`(`folderId`, `cardId`),
    UNIQUE INDEX `SrsFolderItem_folderId_vocabId_key`(`folderId`, `vocabId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tutorlog` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` INTEGER NOT NULL,
    `mode` VARCHAR(191) NOT NULL,
    `input` VARCHAR(191) NOT NULL,
    `output` VARCHAR(191) NOT NULL,
    `tokens` INTEGER NULL,
    `cost` DOUBLE NULL,
    `refs` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `TutorLog_userId_fkey`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `user` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `email` VARCHAR(191) NOT NULL,
    `passwordHash` VARCHAR(191) NOT NULL,
    `role` VARCHAR(191) NOT NULL DEFAULT 'USER',
    `profile` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `lastStudiedAt` DATETIME(3) NULL,
    `streak` INTEGER NOT NULL DEFAULT 0,
    `streakUpdatedAt` DATETIME(3) NULL,
    `dailyQuizCount` INTEGER NOT NULL DEFAULT 0,
    `lastQuizDate` DATETIME(3) NULL,
    `hasOverdueCards` BOOLEAN NOT NULL DEFAULT false,
    `lastOverdueCheck` DATETIME(3) NULL,
    `nextOverdueAlarm` DATETIME(3) NULL,

    UNIQUE INDEX `User_email_key`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `uservocab` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` INTEGER NOT NULL,
    `vocabId` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `categoryId` INTEGER NULL,
    `folderId` INTEGER NULL,

    INDEX `UserVocab_categoryId_fkey`(`categoryId`),
    INDEX `UserVocab_folderId_fkey`(`folderId`),
    INDEX `UserVocab_userId_categoryId_idx`(`userId`, `categoryId`),
    INDEX `UserVocab_userId_folderId_idx`(`userId`, `folderId`),
    INDEX `UserVocab_vocabId_fkey`(`vocabId`),
    UNIQUE INDEX `UserVocab_userId_vocabId_folderId_key`(`userId`, `vocabId`, `folderId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `vocab` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `lemma` VARCHAR(191) NOT NULL,
    `pos` VARCHAR(191) NOT NULL,
    `plural` VARCHAR(191) NULL,
    `levelCEFR` VARCHAR(191) NOT NULL,
    `freq` INTEGER NULL,
    `source` VARCHAR(191) NULL,

    INDEX `Vocab_lemma_idx`(`lemma`),
    INDEX `Vocab_source_idx`(`source`),
    UNIQUE INDEX `Vocab_lemma_pos_key`(`lemma`, `pos`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `wronganswer` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` INTEGER NOT NULL,
    `vocabId` INTEGER NOT NULL,
    `wrongAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `reviewWindowStart` DATETIME(3) NOT NULL,
    `reviewWindowEnd` DATETIME(3) NOT NULL,
    `reviewedAt` DATETIME(3) NULL,
    `isCompleted` BOOLEAN NOT NULL DEFAULT false,
    `attempts` INTEGER NOT NULL DEFAULT 0,
    `folderId` INTEGER NULL,

    INDEX `WrongAnswer_reviewWindowStart_reviewWindowEnd_idx`(`reviewWindowStart`, `reviewWindowEnd`),
    INDEX `WrongAnswer_userId_isCompleted_idx`(`userId`, `isCompleted`),
    INDEX `WrongAnswer_vocabId_fkey`(`vocabId`),
    INDEX `WrongAnswer_folderId_fkey`(`folderId`),
    UNIQUE INDEX `WrongAnswer_userId_vocabId_folderId_wrongAt_key`(`userId`, `vocabId`, `folderId`, `wrongAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `exam_categories` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NULL,
    `totalWords` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `exam_categories_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `vocab_exam_categories` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `vocabId` INTEGER NOT NULL,
    `examCategoryId` INTEGER NOT NULL,
    `priority` INTEGER NOT NULL DEFAULT 0,
    `addedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `vocab_exam_categories_examCategoryId_idx`(`examCategoryId`),
    INDEX `vocab_exam_categories_vocabId_idx`(`vocabId`),
    UNIQUE INDEX `vocab_exam_categories_vocabId_examCategoryId_key`(`vocabId`, `examCategoryId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `category` ADD CONSTRAINT `Category_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `dailystudystat` ADD CONSTRAINT `DailyStudyStat_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `dictentry` ADD CONSTRAINT `DictEntry_vocabId_fkey` FOREIGN KEY (`vocabId`) REFERENCES `vocab`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `srscard` ADD CONSTRAINT `SRSCard_categoryId_fkey` FOREIGN KEY (`categoryId`) REFERENCES `category`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `srscard` ADD CONSTRAINT `SRSCard_folderId_fkey` FOREIGN KEY (`folderId`) REFERENCES `srsfolder`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `srscard` ADD CONSTRAINT `SRSCard_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `srsfolder` ADD CONSTRAINT `SrsFolder_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `srsfolderitem` ADD CONSTRAINT `SrsFolderItem_cardId_fkey` FOREIGN KEY (`cardId`) REFERENCES `srscard`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `srsfolderitem` ADD CONSTRAINT `SrsFolderItem_folderId_fkey` FOREIGN KEY (`folderId`) REFERENCES `srsfolder`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `srsfolderitem` ADD CONSTRAINT `SrsFolderItem_vocabId_fkey` FOREIGN KEY (`vocabId`) REFERENCES `vocab`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tutorlog` ADD CONSTRAINT `TutorLog_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `uservocab` ADD CONSTRAINT `UserVocab_categoryId_fkey` FOREIGN KEY (`categoryId`) REFERENCES `category`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `uservocab` ADD CONSTRAINT `UserVocab_folderId_fkey` FOREIGN KEY (`folderId`) REFERENCES `srsfolder`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `uservocab` ADD CONSTRAINT `UserVocab_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `uservocab` ADD CONSTRAINT `UserVocab_vocabId_fkey` FOREIGN KEY (`vocabId`) REFERENCES `vocab`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `wronganswer` ADD CONSTRAINT `WrongAnswer_folderId_fkey` FOREIGN KEY (`folderId`) REFERENCES `srsfolder`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `wronganswer` ADD CONSTRAINT `WrongAnswer_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `wronganswer` ADD CONSTRAINT `WrongAnswer_vocabId_fkey` FOREIGN KEY (`vocabId`) REFERENCES `vocab`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `vocab_exam_categories` ADD CONSTRAINT `vocab_exam_categories_vocabId_fkey` FOREIGN KEY (`vocabId`) REFERENCES `vocab`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `vocab_exam_categories` ADD CONSTRAINT `vocab_exam_categories_examCategoryId_fkey` FOREIGN KEY (`examCategoryId`) REFERENCES `exam_categories`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
