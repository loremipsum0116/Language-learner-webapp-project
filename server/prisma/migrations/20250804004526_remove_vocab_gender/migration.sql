/*
  Warnings:

  - You are about to drop the column `gender` on the `vocab` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[topicId]` on the table `GrammarExercise` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `topicId` to the `GrammarExercise` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `grammarexercise` ADD COLUMN `topicId` VARCHAR(191) NOT NULL;

-- AlterTable
ALTER TABLE `vocab` DROP COLUMN `gender`;

-- CreateIndex
CREATE UNIQUE INDEX `GrammarExercise_topicId_key` ON `GrammarExercise`(`topicId`);
