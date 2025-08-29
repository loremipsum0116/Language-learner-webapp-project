// server/services/wrongAnswerCleanupService.js
const { prisma } = require('../lib/prismaClient');

/**
 * 고아 상태의 오답노트 항목들을 정리합니다.
 * 이 함수는 정기적으로 실행되어야 합니다.
 */
async function cleanupOrphanedWrongAnswers() {
  console.log('[WRONG ANSWER CLEANUP] Starting orphaned wrong answer cleanup');
  
  try {
    // 1. folderId가 null인 오답노트 항목들 (폴더와 연결되지 않은 항목들)
    const nullFolderCount = await prisma.wronganswer.count({
      where: { folderId: null }
    });
    
    if (nullFolderCount > 0) {
      const deleteResult = await prisma.wronganswer.deleteMany({
        where: { folderId: null }
      });
      console.log(`[WRONG ANSWER CLEANUP] Deleted ${deleteResult.count} wrong answers with null folderId`);
    }
    
    // 2. folderId가 있지만 실제 폴더가 존재하지 않는 오답노트 항목들
    const orphanedWrongAnswers = await prisma.wronganswer.findMany({
      where: { 
        folderId: { not: null } 
      },
      include: {
        folder: { select: { id: true } }
      }
    });
    
    const orphanedIds = orphanedWrongAnswers
      .filter(wa => !wa.folder)
      .map(wa => wa.id);
    
    if (orphanedIds.length > 0) {
      const deleteResult = await prisma.wronganswer.deleteMany({
        where: { id: { in: orphanedIds } }
      });
      console.log(`[WRONG ANSWER CLEANUP] Deleted ${deleteResult.count} wrong answers referencing deleted folders`);
    }
    
    const totalCleaned = nullFolderCount + orphanedIds.length;
    console.log(`[WRONG ANSWER CLEANUP] Cleanup complete. Total items cleaned: ${totalCleaned}`);
    
    return totalCleaned;
    
  } catch (error) {
    console.error('[WRONG ANSWER CLEANUP] Error during cleanup:', error);
    throw error;
  }
}

/**
 * 특정 폴더 삭제 시 관련 오답노트 항목들을 삭제합니다.
 * Prisma cascade deletion이 작동하지 않을 경우를 대비한 보험용 함수입니다.
 */
async function cleanupWrongAnswersForDeletedFolder(folderId, userId) {
  console.log(`[WRONG ANSWER CLEANUP] Cleaning up wrong answers for deleted folder: ${folderId}, user: ${userId}`);
  
  try {
    const deleteResult = await prisma.wronganswer.deleteMany({
      where: {
        folderId: folderId,
        userId: userId
      }
    });
    
    console.log(`[WRONG ANSWER CLEANUP] Deleted ${deleteResult.count} wrong answers for folder ${folderId}`);
    return deleteResult.count;
    
  } catch (error) {
    console.error(`[WRONG ANSWER CLEANUP] Error cleaning up wrong answers for folder ${folderId}:`, error);
    throw error;
  }
}

/**
 * 특정 사용자의 모든 오답노트를 정리합니다.
 */
async function cleanupAllWrongAnswersForUser(userId) {
  console.log(`[WRONG ANSWER CLEANUP] Cleaning up all wrong answers for user: ${userId}`);
  
  try {
    // 먼저 고아 항목들 정리
    await cleanupOrphanedWrongAnswers();
    
    // 사용자의 전체 오답노트 상태 확인
    const userWrongAnswers = await prisma.wronganswer.findMany({
      where: { userId },
      include: {
        folder: { select: { id: true, name: true } },
        vocab: { select: { lemma: true } }
      }
    });
    
    console.log(`[WRONG ANSWER CLEANUP] User ${userId} has ${userWrongAnswers.length} wrong answer records`);
    
    // 고아 항목들 추가 검사
    const orphaned = userWrongAnswers.filter(wa => wa.folderId && !wa.folder);
    if (orphaned.length > 0) {
      console.log(`[WRONG ANSWER CLEANUP] Found ${orphaned.length} additional orphaned items for user ${userId}`);
      const orphanedIds = orphaned.map(wa => wa.id);
      
      const deleteResult = await prisma.wronganswer.deleteMany({
        where: { id: { in: orphanedIds } }
      });
      
      console.log(`[WRONG ANSWER CLEANUP] Deleted ${deleteResult.count} additional orphaned items`);
    }
    
    return userWrongAnswers.length - orphaned.length; // 정리 후 남은 항목 수
    
  } catch (error) {
    console.error(`[WRONG ANSWER CLEANUP] Error cleaning up wrong answers for user ${userId}:`, error);
    throw error;
  }
}

/**
 * 정기적으로 실행할 전체 시스템 정리 함수
 */
async function performSystemWideCleanup() {
  console.log('[WRONG ANSWER CLEANUP] Starting system-wide cleanup');
  
  try {
    const cleanedCount = await cleanupOrphanedWrongAnswers();
    
    // 추가 정리 작업들
    // 1. 너무 오래된 완료된 오답노트 삭제 (예: 30일 이상된 완료 항목)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const oldCompletedResult = await prisma.wronganswer.deleteMany({
      where: {
        isCompleted: true,
        reviewedAt: { lt: thirtyDaysAgo }
      }
    });
    
    console.log(`[WRONG ANSWER CLEANUP] Deleted ${oldCompletedResult.count} old completed wrong answers`);
    
    const totalCleaned = cleanedCount + oldCompletedResult.count;
    console.log(`[WRONG ANSWER CLEANUP] System-wide cleanup complete. Total cleaned: ${totalCleaned}`);
    
    return {
      orphanedCleaned: cleanedCount,
      oldCompletedCleaned: oldCompletedResult.count,
      totalCleaned
    };
    
  } catch (error) {
    console.error('[WRONG ANSWER CLEANUP] Error during system-wide cleanup:', error);
    throw error;
  }
}

module.exports = {
  cleanupOrphanedWrongAnswers,
  cleanupWrongAnswersForDeletedFolder,
  cleanupAllWrongAnswersForUser,
  performSystemWideCleanup
};