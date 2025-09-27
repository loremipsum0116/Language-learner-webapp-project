// services/autoTimerSyncService.js
// 자동 타이머 동일화 서비스

const { prisma } = require('../lib/prismaClient');
const { synchronizeSubfolderTimers } = require('./timerSyncService');

/**
 * 사용자별 자동 동일화 설정 확인
 * @param {number} userId - 사용자 ID
 * @returns {Object} - 자동 동일화 설정
 */
async function getUserAutoSyncSettings(userId) {
    try {
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: {
                personalizedSRS: true
            }
        });

        const settings = user?.personalizedSRS || {};
        return {
            enabled: settings.autoTimerSync?.enabled ?? true, // 기본값을 true로 변경
            maxDifference: settings.autoTimerSync?.maxDifference || 60, // 분 단위
            excludeSubfolders: settings.autoTimerSync?.excludeSubfolders || [],
            onlyOnReview: settings.autoTimerSync?.onlyOnReview ?? false // 주기적 실행도 허용
        };
    } catch (error) {
        console.error('[AUTO SYNC] Error getting user settings:', error);
        return {
            enabled: true, // 에러 시에도 기본값 활성화
            maxDifference: 60,
            excludeSubfolders: [],
            onlyOnReview: false
        };
    }
}

/**
 * 사용자별 자동 동일화 설정 업데이트
 * @param {number} userId - 사용자 ID
 * @param {Object} settings - 설정 객체
 */
async function updateUserAutoSyncSettings(userId, settings) {
    try {
        const currentUser = await prisma.user.findUnique({
            where: { id: userId },
            select: { personalizedSRS: true }
        });

        const currentSettings = currentUser?.personalizedSRS || {};
        const newSettings = {
            ...currentSettings,
            autoTimerSync: {
                ...currentSettings.autoTimerSync,
                ...settings
            }
        };

        await prisma.user.update({
            where: { id: userId },
            data: {
                personalizedSRS: newSettings
            }
        });

        console.log(`[AUTO SYNC] Updated settings for user ${userId}:`, settings);
        return true;
    } catch (error) {
        console.error('[AUTO SYNC] Error updating user settings:', error);
        return false;
    }
}

/**
 * 복습 완료 후 자동 동일화 실행
 * @param {number} userId - 사용자 ID
 * @param {number} cardId - 복습 완료된 카드 ID
 * @param {number} folderId - 폴더 ID
 */
async function triggerAutoSyncAfterReview(userId, cardId, folderId) {
    try {
        // 1. 사용자 설정 확인
        const settings = await getUserAutoSyncSettings(userId);
        if (!settings.enabled) {
            return { triggered: false, reason: 'Auto sync disabled' };
        }

        // 2. 폴더 정보 확인 (folderId를 직접 받아서 사용)
        if (!folderId) {
            return { triggered: false, reason: 'No folder ID provided' };
        }

        const folder = await prisma.srsfolder.findUnique({
            where: { id: folderId },
            select: { id: true, name: true }
        });

        if (!folder) {
            return { triggered: false, reason: 'Folder not found' };
        }

        const subfolderId = folderId;
        const subfolderName = folder.name;

        // 3. 제외 목록 확인
        if (settings.excludeSubfolders.includes(subfolderId)) {
            return { triggered: false, reason: 'Subfolder excluded' };
        }

        // 4. 자동 동일화 실행
        console.log(`[AUTO SYNC] Triggering auto sync for user ${userId}, subfolder ${subfolderId} after review`);
        const result = await synchronizeSubfolderTimers(userId, subfolderId);

        if (result.success && result.totalSyncedCards > 0) {
            console.log(`[AUTO SYNC] Successfully synced ${result.totalSyncedCards} cards in subfolder "${subfolderName}"`);
            return {
                triggered: true,
                result: result,
                subfolderId: subfolderId,
                subfolderName: subfolderName
            };
        } else {
            return {
                triggered: false,
                reason: result.message || 'No cards to sync'
            };
        }

    } catch (error) {
        console.error('[AUTO SYNC] Error in triggerAutoSyncAfterReview:', error);
        return { triggered: false, reason: `Error: ${error.message}` };
    }
}

/**
 * 주기적 자동 동일화 실행 (크론잡용)
 * @param {number} userId - 특정 사용자 ID (선택적)
 */
async function runPeriodicAutoSync(userId = null) {
    try {
        console.log(`[AUTO SYNC] Starting periodic auto sync${userId ? ` for user ${userId}` : ''}`);

        // 1. 모든 사용자 조회 (설정 무시하고 무조건 실행)
        const whereClause = {};

        if (userId) {
            whereClause.id = userId;
        }

        const allUsers = await prisma.user.findMany({
            where: whereClause,
            select: {
                id: true,
                personalizedSRS: true
            }
        });

        console.log(`[AUTO SYNC] Found ${allUsers.length} users for auto sync processing`);

        let totalProcessed = 0;
        let totalSynced = 0;

        for (const user of allUsers) {
            // 설정 확인 없이 무조건 실행

            // 2. 사용자의 모든 하위 폴더 조회 (제외 없이 모든 폴더)
            const subfolders = await prisma.srsfolder.findMany({
                where: {
                    userId: user.id,
                    parentId: { not: null } // 하위 폴더만
                },
                select: { id: true, name: true }
            });

            for (const subfolder of subfolders) {
                const result = await synchronizeSubfolderTimers(user.id, subfolder.id);

                totalProcessed++;

                if (result.success && result.totalSyncedCards > 0) {
                    totalSynced += result.totalSyncedCards;
                    console.log(`[AUTO SYNC] User ${user.id}, Subfolder "${subfolder.name}": synced ${result.totalSyncedCards} cards`);
                }
            }
        }

        console.log(`[AUTO SYNC] Periodic sync completed: ${totalProcessed} subfolders processed, ${totalSynced} total cards synced`);
        return { totalProcessed, totalSynced };

    } catch (error) {
        console.error('[AUTO SYNC] Error in runPeriodicAutoSync:', error);
        return { totalProcessed: 0, totalSynced: 0 };
    }
}

/**
 * 하위 폴더별 자동 동일화 즉시 실행
 * @param {number} userId - 사용자 ID
 * @param {number} subfolderId - 하위 폴더 ID
 */
async function runImmediateAutoSync(userId, subfolderId) {
    try {
        const settings = await getUserAutoSyncSettings(userId);
        if (!settings.enabled) {
            return { triggered: false, reason: 'Auto sync disabled' };
        }

        if (settings.excludeSubfolders.includes(subfolderId)) {
            return { triggered: false, reason: 'Subfolder excluded' };
        }

        console.log(`[AUTO SYNC] Running immediate sync for user ${userId}, subfolder ${subfolderId}`);
        const result = await synchronizeSubfolderTimers(userId, subfolderId);

        return {
            triggered: true,
            result: result
        };

    } catch (error) {
        console.error('[AUTO SYNC] Error in runImmediateAutoSync:', error);
        return { triggered: false, reason: `Error: ${error.message}` };
    }
}

module.exports = {
    getUserAutoSyncSettings,
    updateUserAutoSyncSettings,
    triggerAutoSyncAfterReview,
    runPeriodicAutoSync,
    runImmediateAutoSync
};