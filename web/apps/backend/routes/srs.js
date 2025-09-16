// server/routes/srs.js  — clean drop‑in (CommonJS only)
// -----------------------------------------------------------
// • 모든 req.user가 필요한 라우트는 router.use(auth) 한 번만 선언
// • KST 기준 날짜 처리(startOfKstDay)
// • 라우트 중복/ESM 혼용 제거
// • 하위폴더 중복 검사는 (userId, parentId, name) 범위에서만 수행
// -----------------------------------------------------------
console.log('[SRS ROUTER] build=2025-08-08_#3 loaded');

const express = require('express');
const router = express.Router();

// 모든 SRS API 요청 로깅
console.log('🔧 [SRS SETUP] Setting up SRS API request logging middleware');
router.use((req, res, next) => {
    console.log(`📋 [SRS API] ${req.method} ${req.originalUrl}`);
    next();
});

const dayjs = require('dayjs');
const utc = require('dayjs/plugin/utc');
const tz = require('dayjs/plugin/timezone');
dayjs.extend(utc); dayjs.extend(tz);

const { prisma } = require('../lib/prismaClient');
const { ok, fail } = require('../lib/resp');
const {
    generateMcqQuizItems,
    generateQuizByLanguageAndType,
    detectLanguage
} = require('../services/quizService');
const auth = require('../middleware/auth');
const { scheduleFolder } = require('../services/alarmQueue');
const { nextAlarmSlot } = require('../utils/alarmTime');
const { parseKstDateYYYYMMDD, startOfKstDay } = require('../lib/kst');

// ────────────────────────────────────────────────────────────
// 공통
// ────────────────────────────────────────────────────────────
const KST = 'Asia/Seoul';
const SIX_HOURS = 6;
function nextSixHourSlot(now = dayjs()) {
    const hour = now.hour();
    const slot = [0, 6, 12, 18].find((h) => h > hour);
    const next = slot ?? 24; // 다음날 00시
    const base = slot != null ? now.startOf('hour') : now.add(1, 'day').startOf('day');
    return base.hour(next).minute(0).second(0).millisecond(0);
}

// req.user가 필요한 모든 라우트에 인증
router.use(auth);

// 새로운 서비스 임포트
const { 
    createManualFolder, 
    completeFolderAndScheduleNext, 
    restartMasteredFolder,
    getAvailableCardsForReview,
    getWaitingCardsCount,
    getSrsStatus
} = require('../services/srsService');
const { getUserStreakInfo } = require('../services/streakService');
const { 
    getWrongAnswers, 
    getAvailableWrongAnswersCount, 
    generateWrongAnswerQuiz,
    completeWrongAnswer 
} = require('../services/wrongAnswerService');

// === 새로운 SRS 시스템 API 엔드포인트들 ===

// GET /srs/status - 사용자의 현재 SRS 상태 조회
router.get('/status', async (req, res, next) => {
    try {
        const userId = req.user.id;
        const status = await getSrsStatus(userId);
        return ok(res, status);
    } catch (e) {
        next(e);
    }
});

// GET /srs/available - 현재 학습 가능한 카드들 조회
router.get('/available', async (req, res, next) => {
    try {
        const userId = req.user.id;
        const cards = await getAvailableCardsForReview(userId);
        return ok(res, cards);
    } catch (e) {
        next(e);
    }
});

// GET /srs/waiting-count - 대기 중인 카드 수 조회
router.get('/waiting-count', async (req, res, next) => {
    try {
        const userId = req.user.id;
        const count = await getWaitingCardsCount(userId);
        return ok(res, { waitingCount: count });
    } catch (e) {
        next(e);
    }
});

// GET /srs/mastered - 마스터 완료 단어 조회
// 마스터된 카드의 간단한 정보만 반환 (VocabList용)
router.get('/mastered-cards', async (req, res, next) => {
    try {
        const userId = req.user.id;
        
        const masteredCards = await prisma.srscard.findMany({
            where: {
                userId: userId,
                isMastered: true
            },
            include: {
                srsfolderitem: {
                    include: {
                        vocab: {
                            include: {
                                dictentry: true
                            }
                        }
                    }
                }
            }
        });
        
        ok(res, masteredCards);
    } catch (error) {
        console.error('Failed to fetch mastered cards:', error);
        next(error);
    }
});

router.get('/mastered', async (req, res, next) => {
    try {
        const userId = req.user.id;
        const { limit = 50, offset = 0, sortBy = 'masteredAt', sortOrder = 'desc' } = req.query;
        
        const masteredCards = await prisma.srscard.findMany({
            where: {
                userId: userId,
                isMastered: true
            },
            include: {
                srsfolderitem: {
                    include: {
                        vocab: {
                            include: {
                                dictentry: true
                            }
                        }
                    }
                }
            },
            orderBy: {
                [sortBy]: sortOrder
            },
            take: parseInt(limit),
            skip: parseInt(offset)
        });
        
        // 마스터 단어 통계
        const totalMastered = await prisma.srscard.count({
            where: {
                userId: userId,
                isMastered: true
            }
        });
        
        // 사용자 마스터 단어 대시보드 정보
        const masteryStats = await prisma.srscard.groupBy({
            by: ['masterCycles'],
            where: {
                userId: userId,
                isMastered: true
            },
            _count: {
                masterCycles: true
            }
        });
        
        // 데이터 정제 및 가공
        const processedCards = masteredCards.map(card => {
            const vocab = card.srsfolderitem[0]?.vocab || null;
            return {
                id: card.id,
                stage: card.stage,
                isMastered: card.isMastered,
                masteredAt: card.masteredAt,
                masterCycles: card.masterCycles,
                correctTotal: card.correctTotal,
                wrongTotal: card.wrongTotal,
                vocab: vocab ? {
                    id: vocab.id,
                    lemma: vocab.lemma,
                    pos: vocab.pos,
                    levelCEFR: vocab.levelCEFR,
                    dictentry: vocab.dictentry
                } : null
            };
        });
        
        return ok(res, {
            masteredCards: processedCards,
            totalMastered,
            masteryStats,
            pagination: {
                limit: parseInt(limit),
                offset: parseInt(offset),
                hasMore: parseInt(offset) + processedCards.length < totalMastered
            }
        });
        
    } catch (e) {
        console.error('[SRS MASTERED] Error:', e);
        next(e);
    }
});

// GET /srs/mastery-stats - 마스터 통계 정보
router.get('/mastery-stats', async (req, res, next) => {
    try {
        const userId = req.user.id;
        
        // 기본 통계
        const basicStats = await prisma.srscard.groupBy({
            by: ['isMastered'],
            where: { userId: userId },
            _count: { isMastered: true }
        });
        
        // 마스터 사이클별 통계
        const cycleStats = await prisma.srscard.groupBy({
            by: ['masterCycles'],
            where: {
                userId: userId,
                isMastered: true
            },
            _count: { masterCycles: true },
            orderBy: { masterCycles: 'asc' }
        });
        
        // 최근 마스터 완룉
        const recentMastery = await prisma.srscard.findMany({
            where: {
                userId: userId,
                isMastered: true
            },
            orderBy: { masteredAt: 'desc' },
            take: 5,
            include: {
                srsfolderitem: {
                    include: {
                        vocab: true
                    }
                }
            }
        });
        
        const totalCards = basicStats.reduce((sum, stat) => sum + stat._count.isMastered, 0);
        const masteredCount = basicStats.find(stat => stat.isMastered)?._count?.isMastered || 0;
        const masteryRate = totalCards > 0 ? (masteredCount / totalCards * 100).toFixed(1) : 0;
        
        return ok(res, {
            totalCards,
            masteredCount,
            masteryRate: parseFloat(masteryRate),
            cycleStats,
            recentMastery: recentMastery.map(card => ({
                lemma: card.srsfolderitem[0]?.vocab?.lemma || 'Unknown',
                masteredAt: card.masteredAt,
                masterCycles: card.masterCycles
            }))
        });
        
    } catch (e) {
        console.error('[SRS MASTERY STATS] Error:', e);
        next(e);
    }
});

// srs.js 상단 router 선언 직후에 추가
const FLAT_MODE = false; // 3단계 구조 활성화
if (FLAT_MODE) {
    // 하위폴더 읽기: 항상 빈 목록
    router.get('/folders/:id/children', (req, res) => ok(res, []));
    router.get('/folders/:rootId/children-lite', (req, res) => ok(res, []));

    // 하위폴더 생성/배치 생성: 사용 중지
    router.post('/folders/:parentId/subfolders', (req, res) => fail(res, 410, 'Subfolders are disabled in flat mode'));
    router.post('/folders/:rootId/children', (req, res) => fail(res, 410, 'Subfolders are disabled in flat mode'));
}


// Forgetting curve intervals in days.
const FORGETTING_CURVE_INTERVALS = [3, 7, 14, 30, 60, 120];

// ==== Flat-friendly dashboard (prepended to override older handler) ====

/**
 * Calculates the next review date based on the current stage.
 * @param {number} currentStage - The current stage of the folder.
 * @returns {{ newStage: number, nextReviewAt: Date }}
 */
const { STAGE_DELAYS, computeNextReviewDate, isFinalStage } = require('../services/srsSchedule');

// ────────────────────────────────────────────────────────────
// 폴더 API
// ────────────────────────────────────────────────────────────

// (NEW) POST /srs/folders — Create a new manual learning folder (3단계 구조 지원)
router.post('/folders', async (req, res, next) => {
    try {
        const userId = req.user.id;
        const { name, vocabIds = [], parentId = null, learningCurveType = "long" } = req.body;
        if (!name || typeof name !== 'string' || name.trim().length === 0) {
            return fail(res, 400, 'A valid name is required.');
        }

        // parentId가 있으면 해당 부모 폴더의 소유권 확인
        if (parentId) {
            const parent = await prisma.srsfolder.findFirst({
                where: { id: parentId, userId },
                select: { id: true, date: true, kind: true, learningCurveType: true }
            });
            if (!parent) {
                return fail(res, 404, 'Parent folder not found.');
            }
            
            // 하위 폴더 생성 시 부모의 설정 상속
            const uniqueKind = `custom:${parentId}:${Date.now()}`;
            const folder = await prisma.srsfolder.create({
                data: {
                    userId,
                    parentId,
                    name: name.trim(),
                    date: parent.date,
                    createdDate: parent.date || new Date(),
                    kind: uniqueKind,
                    stage: 0,
                    nextReviewDate: parent.date,
                    alarmActive: true,
                    learningCurveType: parent.learningCurveType || "long", // 부모 폴더의 학습 곡선 타입 상속
                    updatedAt: new Date(),
                },
                select: {
                    id: true,
                    name: true,
                    parentId: true,
                    stage: true,
                    kind: true,
                    createdDate: true,
                    alarmActive: true
                }
            });

            return ok(res, folder);
        } else {
            // 최상위 폴더 생성 (기존 로직)
            const folder = await createManualFolder(userId, name.trim(), vocabIds, learningCurveType);

            return ok(res, {
                id: folder.id,
                name: folder.name,
                parentId: null,
                stage: folder.stage,
                kind: folder.kind,
                createdDate: folder.createdDate,
                alarmActive: folder.alarmActive
            });
        }
    } catch (e) {
        if (e.code === 'P2002') return fail(res, 409, 'A folder with this name already exists.');
        next(e);
    }
});

// (MODIFIED) GET /srs/dashboard — Fetch all folders, sorted by due date (3단계 구조 지원)
router.get('/dashboard', async (req, res, next) => {
    try {
        const userId = req.user.id;
        const folders = await prisma.srsfolder.findMany({
            where: { userId },
            select: {
                id: true, name: true, parentId: true,
                createdDate: true,        
                nextReviewDate: true,     
                stage: true, alarmActive: true,
                learningCurveType: true,
                _count: { select: { srsfolderitem: true } },
            },
            orderBy: [
                { parentId: 'asc' },      // 최상위 폴더가 먼저
                { nextReviewDate: 'asc' }, 
                { id: 'asc' }
            ],
        });

        // 상위폴더만 반환 (하위폴더는 별도 API에서 처리)
        const topLevelFolders = folders.filter(f => f.parentId === null);
        const subFolders = folders.filter(f => f.parentId !== null);
        
        const data = topLevelFolders.map(topFolder => {
            const children = subFolders.filter(sub => sub.parentId === topFolder.id);
            const totalItems = children.reduce((sum, child) => sum + child._count.srsfolderitem, 0);
            
            return {
                id: topFolder.id,
                name: topFolder.name,
                parentId: null,
                createdDate: topFolder.createdDate,
                nextReviewDate: topFolder.nextReviewDate,
                stage: topFolder.stage,
                alarmActive: topFolder.alarmActive,
                learningCurveType: topFolder.learningCurveType, // 학습 곡선 타입 추가
                total: totalItems, // 상위폴더 자체 카드는 0, 하위폴더들의 카드 합계만
                hasChildren: children.length > 0,
                childrenCount: children.length,
                type: 'parent' // 상위폴더 표시
            };
        });
        
        console.log('[SRS DASHBOARD] Response data:', JSON.stringify(data, null, 2));

        return ok(res, data);
    } catch (e) {
        next(e);
    }
});


// (NEW) POST /srs/folders/:id/complete — Mark a review session as complete
router.post('/folders/:id/complete', async (req, res, next) => {
    try {
        const userId = req.user.id;
        const id = Number(req.params.id);

        const folder = await prisma.srsfolder.findFirst({ where: { id, userId } });
        if (!folder) return fail(res, 404, 'Folder not found.');

        const DELAYS = [3, 7, 14, 30, 60, 120]; // 상한 120일
        const nextStage = Math.min(folder.stage + 1, DELAYS.length - 1);
        const baseDate = folder.createdDate ?? startOfKstDay();
        const nextDate = dayjs(baseDate).add(DELAYS[nextStage], 'day').toDate();
        const isFinal = nextStage === (DELAYS.length - 1);
        const doneAll = nextStage === STAGE_DELAYS.length - 1;
        const updatedFolder = await prisma.srsfolder.update({
            where: { id },
            data: {
                stage: nextStage,
                nextReviewDate: nextDate,
                lastReviewedAt: new Date(),
                alarmActive: isFinal ? false : folder.alarmActive,
                lastReviewedAt: new Date(),
                alarmActive: doneAll ? false : folder.alarmActive,  // ★ 120일 완주 시 자동 OFF
            },
        });

        // Reset learned state for all items in the folder for the next session
        await prisma.srsfolderitem.updateMany({
            where: { folderId: id },
            data: { learned: false, wrongCount: 0 },
        });

        return ok(res, updatedFolder);
    } catch (e) {
        next(e);
    }
});

// server/routes/srs.js  (기존 router에 추가)
// (MODIFIED) POST /srs/folders/:id/alarm — Toggle alarm AND reset progress if re-enabled
router.post('/folders/:id/alarm', async (req, res, next) => {
    try {
        const userId = req.user.id;
        const id = Number(req.params.id);
        const { active } = req.body; // Only need 'active' status

        const folder = await prisma.srsfolder.findFirst({ where: { id, userId } });
        if (!folder) return fail(res, 404, 'Folder not found.');

        let dataToUpdate = { alarmActive: !!active };

        // If turning the alarm ON, reset the folder's progress
        if (active) {
            const today = startOfKstDay().toDate();
            dataToUpdate = {
                ...dataToUpdate,
                stage: 0,
                createdDate: today,
                nextReviewDate: today,     // 당일 due
                cycleAnchorAt: new Date(),         // 앵커를 '재시작 시점'으로
            };
            // Reset items within the folder as well
            await prisma.srsfolderitem.updateMany({
                where: { folderId: id },
                data: { learned: false, wrongCount: 0 },
            });
        }

        const updatedFolder = await prisma.srsfolder.update({
            where: { id },
            data: dataToUpdate,
        });

        return ok(res, updatedFolder);
    } catch (e) {
        next(e);
    }
});

// GET /srs/reminders/today - overdue 기반 알림 조회
router.get('/reminders/today', async (req, res, next) => {
    try {
        const userId = req.user.id;
        const now = new Date();
        const nowKst = dayjs().tz('Asia/Seoul');
        const tickIndex = [0, 6, 12, 18].findIndex(h => nowKst.hour() >= h && nowKst.hour() < (h === 18 ? 24 : [0, 6, 12, 18][[0, 6, 12, 18].indexOf(h) + 1]));
        const currentTick = [0, 6, 12, 18][tickIndex] ?? 0;

        // 사용자의 알림 시각 확인
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { 
                nextOverdueAlarm: true,
                lastOverdueCheck: true 
            }
        });

        // overdue 카드 수 조회 (SRS 폴더에 실제로 존재하는 단어만)
        const overdueCount = await prisma.srscard.count({
            where: {
                userId: userId,
                isOverdue: true,
                overdueDeadline: { gt: now },
                srsfolderitem: {
                    some: {} // SRS 폴더에 포함된 카드만
                }
            }
        });

        // 실제 overdue 카드가 없으면 알림하지 않음
        if (!user || overdueCount === 0) {
            return ok(res, {
                hasOverdueCards: false,
                shouldNotifyNow: false,
                overdueCount: 0,
                tick: currentTick,
                message: '복습할 overdue 단어가 없습니다.'
            });
        }

        // 알림 시간인지 확인
        const shouldNotifyNow = user.nextOverdueAlarm && user.nextOverdueAlarm <= now;

        return ok(res, {
            hasOverdueCards: true,
            shouldNotifyNow: shouldNotifyNow,
            overdueCount: overdueCount,
            nextOverdueAlarm: user.nextOverdueAlarm,
            lastOverdueCheck: user.lastOverdueCheck,
            tick: currentTick,
            message: `${overdueCount}개의 overdue 단어가 복습을 기다리고 있습니다.`
        });
        
    } catch (e) { 
        console.error('[SRS REMINDERS] Error:', e);
        next(e); 
    }
});
// POST /srs/reminders/ack - overdue 알림 확인 처리
router.post('/reminders/ack', async (req, res, next) => {
    try {
        const userId = req.user.id;
        const { tick } = req.body;              // tick: 0|6|12|18
        const now = new Date();
        const nextAlarmTime = new Date(now.getTime() + 6 * 60 * 60 * 1000); // 6시간 후

        // overdue 카드 수 확인 (SRS 폴더에 실제로 존재하는 단어만)
        const overdueCount = await prisma.srscard.count({
            where: {
                userId: userId,
                isOverdue: true,
                overdueDeadline: { gt: now },
                srsfolderitem: {
                    some: {} // SRS 폴더에 포함된 카드만
                }
            }
        });

        if (overdueCount === 0) {
            return ok(res, { 
                acknowledged: true, 
                message: 'overdue 카드가 없어 알림을 비활성화합니다.' 
            });
        }

        // 알림 확인 및 다음 알림 시각 설정
        await prisma.user.update({
            where: { id: userId },
            data: {
                nextOverdueAlarm: nextAlarmTime
            }
        });

        return ok(res, { 
            acknowledged: true,
            nextAlarmTime: nextAlarmTime,
            tick: tick,
            message: '알림을 확인했습니다. 6시간 후에 다시 알려드립니다.' 
        });
        
    } catch (e) { 
        console.error('[SRS REMINDERS ACK] Error:', e);
        next(e); 
    }
});

// POST /srs/folders/quick-create  → 오늘(KST) 루트 폴더 하나 만들기(이미 있으면 그대로 반환)
router.post('/folders/quick-create', async (req, res, next) => {
    try {
        const userId = req.user.id;
        const kind = req.body?.kind ?? 'manual';
        const enableAlarm = !!req.body?.enableAlarm;

        console.log(`[QUICK-CREATE] userId=${userId}, kind=${kind}, enableAlarm=${enableAlarm}`);

        const date = startOfKstDay(); // KST 00:00(Date 객체)
        console.log(`[QUICK-CREATE] date=${date.toISOString()}`);

        const exists = await prisma.srsfolder.findFirst({
            where: { userId, kind },
            select: { id: true },
        });
        
        if (exists) {
            console.log(`[QUICK-CREATE] Found existing folder: ${exists.id}`);
            return ok(res, { id: exists.id, created: false, reason: 'exists' });
        }

        console.log(`[QUICK-CREATE] Creating new folder...`);
        const now = dayjs();

        const created = await prisma.srsfolder.create({
            data: {
                userId,
                name: `오늘의 SRS - ${now.tz(KST).format('YYYY-MM-DD')}`,
                kind,
                createdDate: date,
                nextReviewDate: date,
                stage: 0,
                autoCreated: true,
                alarmActive: enableAlarm,
                cycleAnchorAt: now.toDate(),
                updatedAt: new Date(),
            },
            select: { id: true },
        });

        console.log(`[QUICK-CREATE] Created folder: ${created.id}`);

        return ok(res, { id: created.id, created: true });
    } catch (e) { 
        console.error(`[QUICK-CREATE] Error:`, e);
        console.error(`[QUICK-CREATE] Error stack:`, e.stack);
        return fail(res, 500, `Folder creation failed: ${e.message}`);
    }
});

// POST /srs/folders/:parentId/subfolders { name }
// 같은 부모(parentId) 안에서만 중복 이름을 막는다.
// 이름 정규화: 전각→반각, 공백 압축, trim, 대소문자 통일(원하면 주석 해제)
const normalizeName = (s) =>
    String(s ?? '')
        .normalize('NFKC')        // 전각 문자 정규화
        .replace(/\s+/g, ' ')     // 다중 공백 제거
        .trim();
//  .toLowerCase();          // 대소문자 무시하려면 활성화

// POST /srs/folders/:parentId/subfolders  { name: string }
router.post('/folders/:parentId/subfolders', async (req, res, next) => {
    try {
        const userId = req.user.id;
        const parentId = Number(req.params.parentId);
        const name = String(req.body?.name ?? '').trim();
        if (!name) return fail(res, 400, 'name is required');

        const parent = await prisma.srsfolder.findFirst({
            where: { id: parentId, userId, parentId: null },
            select: { id: true, date: true, alarmActive: true }
        });
        if (!parent) return fail(res, 404, 'parent not found');

        // 같은 부모에서 이름 중복만 금지
        const dup = await prisma.srsfolder.findFirst({
            where: { userId, parentId, name },
            select: { id: true }
        });
        if (dup) return fail(res, 409, 'duplicate name under parent');

        // ★ 유니크 키 회피: kind를 매번 유일하게
        const uniqueKind = `custom:${parentId}:${Date.now()}`;

        console.log('[SUBFOLDER.CREATE] userId=%s parentId=%s date=%s kind=%s name=%s',
            userId, parentId, parent.date?.toISOString?.(), uniqueKind, name);

        const sub = await prisma.srsfolder.create({
            data: {
                userId,
                parentId,
                name,
                date: parent.date,
                kind: uniqueKind,           // ← 중요
                scheduledOffset: null,      // ← 명시해도 됨 (nullable)
                alarmActive: parent.alarmActive,
                updatedAt: new Date(),
            },
            select: { id: true, name: true }
        });

        return ok(res, sub);
    } catch (e) {
        console.error('[SUBFOLDER.CREATE][ERR]', e);
        if (e.code === 'P2002') return fail(res, 409, 'duplicate name under parent');
        next(e);
    }
});

// === 레거시 SRS 전부 삭제(현재 로그인 사용자) ======================
router.post('/legacy/clear', async (req, res, next) => {
    try {
        const userId = req.user.id;
        const r = await prisma.srscard.deleteMany({ where: { userId } });
        return ok(res, { deleted: r.count });
    } catch (e) { next(e); }
});

// 하위폴더에 단어(vocabIds) 추가 → SRSCard를 (없으면) 만들고 FolderItem 연결
// POST /srs/folders/:id/items   body: { vocabIds?: number[], cardIds?: number[] }
// server/routes/srs.js  (해당 라우트 교체/수정)
// GET /srs/folders/:id/items - Get items for a specific folder quiz
// GET /srs/folders/:id/items  — 단일계층용 폴더 상세 + 오늘 학습 큐
router.get('/folders/:id/items', async (req, res, next) => {
    try {
        const userId = req.user.id;
        const id = Number(req.params.id);
        if (!Number.isFinite(id)) return fail(res, 400, 'invalid id');

        // 1) 폴더 메타
        const folder = await prisma.srsfolder.findFirst({
            where: { id, userId },
            select: {
                id: true, name: true, parentId: true,
                createdDate: true,        // ★
                nextReviewDate: true,     // ★
                stage: true, alarmActive: true,
                learningCurveType: true,  // 학습 곡선 타입 추가
            },
        });
        if (!folder) return fail(res, 404, 'Folder not found');

        // 2) 폴더 아이템(카드/로컬 learned 상태 포함)
        const items = await prisma.srsfolderitem.findMany({
            where: { folderId: id },
            select: {
                id: true, cardId: true, learned: true, wrongCount: true, lastReviewedAt: true,
                vocabId: true,                               // 있으면 바로 사용
                srscard: { 
                    select: { 
                        itemId: true, 
                        nextReviewAt: true, 
                        stage: true,
                        isOverdue: true,
                        overdueDeadline: true,
                        isFromWrongAnswer: true,
                        waitingUntil: true,
                        frozenUntil: true,        // ✅ 동결 필드 추가
                        isMastered: true,
                        masterCycles: true,
                        masteredAt: true,
                        correctTotal: true,       // ✅ 정답 총 횟수 추가
                        wrongTotal: true         // ✅ 오답 총 횟수 추가
                    } 
                },         // 카드의 완전한 SRS 정보 포함
            },
            orderBy: { id: 'asc' },
        });

        // 3) Vocab id 수집 → 일괄 조회
        const vocabIdSet = new Set();
        for (const it of items) {
            if (it.vocabId) vocabIdSet.add(it.vocabId);
            else if (it.srscard?.itemId) vocabIdSet.add(it.srscard.itemId);
        }
        const vocabIds = Array.from(vocabIdSet);
        let vocabMap = new Map();
        if (vocabIds.length > 0) {
            try {
                const vocabs = await prisma.vocab.findMany({
                    where: { id: { in: vocabIds } },
                    select: {
                        id: true,
                        lemma: true,
                        pos: true,
                        levelCEFR: true,
                        languageId: true,
                        levelJLPT: true,
                        dictentry: {
                            select: {
                                ipa: true,
                                ipaKo: true,
                                examples: true
                            }
                        },
                        translations: {
                            where: { languageId: 2 }, // Korean translations
                            select: { translation: true }
                        }
                    }
                });
                vocabMap = new Map(vocabs.map(v => [v.id, v]));
            } catch (vocabError) {
                console.error('Vocab query failed:', vocabError);
                // fallback to basic vocab without dictentry
                const vocabs = await prisma.vocab.findMany({
                    where: { id: { in: vocabIds } },
                    select: {
                        id: true,
                        lemma: true,
                        pos: true,
                        levelCEFR: true
                    }
                });
                vocabMap = new Map(vocabs.map(v => [v.id, v]));
            }
        }

        // 4) 마지막 오답일자 조회 (각 단어별로 가장 최근 오답노트 기록)
        let lastWrongAtMap = new Map();
        if (vocabIds.length > 0) {
            try {
                const latestWrongAnswers = await prisma.wronganswer.findMany({
                    where: {
                        userId,
                        vocabId: { in: vocabIds },
                        folderId: id  // 현재 폴더의 오답만
                    },
                    select: {
                        vocabId: true,
                        wrongAt: true
                    },
                    orderBy: [
                        { vocabId: 'asc' },
                        { wrongAt: 'desc' }
                    ]
                });
                
                // 각 단어별로 가장 최근 오답일자만 저장
                latestWrongAnswers.forEach(wa => {
                    if (!lastWrongAtMap.has(wa.vocabId)) {
                        lastWrongAtMap.set(wa.vocabId, wa.wrongAt);
                    }
                });
            } catch (wrongAnswerError) {
                console.error('Wrong answer query failed:', wrongAnswerError);
                // 오답 정보 조회 실패해도 계속 진행
            }
        }

        // 5) SRS 카드의 오답 대기중 상태 확인 (오답노트가 아닌 카드 자체의 frozen/wrong 상태)
        // 이미 items에서 srscard 정보를 가져왔으므로 추가 쿼리 불필요

        // 5) 화면용 큐(learned=false 기준) 구성
        const quizItems = items.map(it => {
            const vid = it.vocabId ?? it.srscard?.itemId ?? null;
            const v = (vid && vocabMap.get(vid)) || null;

            // Extract Korean translation for Japanese words
            let ko_gloss = null;
            if (v) {
                const isJapanese = v?.languageId === 3;

                // First try Korean translation from VocabTranslation table
                if (v.translations && v.translations.length > 0) {
                    ko_gloss = v.translations[0].translation;
                }
                // For Japanese words, try multiple fallback options
                else if (isJapanese && v.dictentry?.examples) {
                    // Try koExample from dictentry examples object
                    if (typeof v.dictentry.examples === 'object' && v.dictentry.examples.koExample) {
                        ko_gloss = v.dictentry.examples.koExample;
                    }
                    // Try parsing string format examples
                    else if (typeof v.dictentry.examples === 'string') {
                        try {
                            const parsedExamples = JSON.parse(v.dictentry.examples);
                            if (parsedExamples.koExample) {
                                ko_gloss = parsedExamples.koExample;
                            }
                        } catch (e) {
                            console.warn('Failed to parse dictentry.examples for Japanese vocab:', v.lemma, e);
                        }
                    }
                }
                // Fallback for English words (array format)
                else if (!isJapanese && Array.isArray(v.dictentry?.examples)) {
                    const glossExample = v.dictentry.examples.find((ex) => ex?.kind === 'gloss');
                    ko_gloss = glossExample?.ko;
                }
            }
            
            // 디버깅: 전체 srscard 구조 확인
            console.log(`[DEBUG CARD STRUCTURE] Item ${it.id}:`, {
                hasSrscard: !!it.srscard,
                srscard: it.srscard,
                vocabLemma: v?.lemma
            });
            
            // 오답 대기중 상태 판단 (더 포괄적인 조건)
            const isFrozenForWrongAnswer = it.srscard?.frozenUntil && new Date(it.srscard.frozenUntil) > new Date();
            const isFromWrongAnswerAndNotMastered = it.srscard?.isFromWrongAnswer && !it.srscard?.isMastered;
            const isWaitingFromWrongAnswer = it.srscard?.waitingUntil && new Date(it.srscard.waitingUntil) > new Date() && it.srscard?.isFromWrongAnswer;
            const isWrongAnswerWaiting = isFrozenForWrongAnswer || isFromWrongAnswerAndNotMastered || isWaitingFromWrongAnswer;
            
            // 디버깅용 로그 (오답 대기중 상태)
            console.log(`[DEBUG WRONG] Item ${it.id} (${v?.lemma}):`, {
                frozenUntil: it.srscard?.frozenUntil,
                waitingUntil: it.srscard?.waitingUntil,
                isFrozenForWrongAnswer,
                isFromWrongAnswer: it.srscard?.isFromWrongAnswer,
                isMastered: it.srscard?.isMastered,
                isFromWrongAnswerAndNotMastered,
                isWaitingFromWrongAnswer,
                finalIsWrongAnswerWaiting: isWrongAnswerWaiting,
                wrongCount: it.wrongCount
            });
            
            // Add Japanese-specific fields if this is a Japanese word
            const isJapanese = v?.languageId === 3;
            const result = {
                folderItemId: it.id,
                cardId: it.cardId,
                learned: it.learned,
                wrongCount: it.wrongCount,
                lastReviewedAt: it.lastReviewedAt,
                // 개별 카드의 완전한 SRS 정보 추가
                nextReviewAt: it.srscard?.nextReviewAt,
                stage: it.srscard?.stage,
                isOverdue: it.srscard?.isOverdue || false,
                overdueDeadline: it.srscard?.overdueDeadline,
                isFromWrongAnswer: it.srscard?.isFromWrongAnswer || false,
                waitingUntil: it.srscard?.waitingUntil,
                frozenUntil: it.srscard?.frozenUntil,        // ✅ 동결 필드 추가
                isMastered: it.srscard?.isMastered || false,
                masterCycles: it.srscard?.masterCycles || 0,
                masteredAt: it.srscard?.masteredAt,
                correctTotal: it.srscard?.correctTotal || 0,  // ✅ 정답 총 횟수 추가
                wrongTotal: it.srscard?.wrongTotal || 0,      // ✅ 오답 총 횟수 추가
                lastWrongAt: vid ? lastWrongAtMap.get(vid) : null,  // ✅ 마지막 오답일자 추가
                // 동결 상태 정보 추가
                isFrozen: it.srscard?.isFrozen || false,
                frozenUntil: it.srscard?.frozenUntil,
                // 오답 단어 여부 판단 (폴더 레벨)
                isWrongAnswer: it.wrongCount > 0,
                // SRS 카드 오답 대기중 상태 판단 (위에서 계산한 값 사용)
                isWrongAnswerWaiting,
                // Korean translation
                ko_gloss: ko_gloss,
                vocab: v ? {
                    id: v.id,
                    lemma: v.lemma,
                    pos: v.pos,
                    level: v.levelCEFR,
                    languageId: v.languageId,
                    levelJLPT: v.levelJLPT,
                    dictentry: v.dictentry || null,
                } : null,
            };

            // Add Japanese-specific fields if this is a Japanese word
            if (isJapanese && v?.dictentry?.examples) {
                let examples = {};
                if (typeof v.dictentry.examples === 'object') {
                    examples = v.dictentry.examples;
                }

                result.kana = v.dictentry?.ipa || examples.kana || '';
                result.romaji = v.dictentry?.ipaKo || examples.romaji || '';
                result.kanji = examples.kanji || null;
                result.onyomi = examples.onyomi || null;
                result.kunyomi = examples.kunyomi || null;
                result.example = examples.example || '';
                result.koExample = examples.koExample || '';
                result.exampleKana = examples.exampleKana || '';
                result.exampleTranslation = examples.exampleTranslation || '';
            }

            return result;
        });

        // 디버깅: overdue 카드들 로그
        const overdueCards = quizItems.filter(item => item.isOverdue);
        console.log(`[SRS DEBUG] Folder ${id} - Found ${overdueCards.length} overdue cards out of ${quizItems.length} total:`);
        overdueCards.forEach(card => {
            console.log(`  - ${card.vocab?.lemma || 'Unknown'} (cardId: ${card.cardId}, isOverdue: ${card.isOverdue}, stage: ${card.stage})`);
        });
        
        console.log('[DEBUG API RESPONSE] Sample quizItem:', JSON.stringify(quizItems[0], null, 2));
        return ok(res, { folder, quizItems });
    } catch (e) {
        console.error('GET /srs/folders/:id/items failed:', e);
        console.error('Error details:', {
            message: e.message,
            stack: e.stack,
            code: e.code
        });
        
        // Prisma 관련 에러에 대한 더 나은 에러 메시지
        if (e.code === 'P2025') {
            return fail(res, 404, 'Folder not found');
        } else if (e.code?.startsWith('P')) {
            return fail(res, 500, 'Database error occurred');
        }
        
        return fail(res, 500, `Internal Server Error: ${e.message}`);
    }
});





// GET /srs/folders/:id/children  → 상위폴더의 하위폴더 목록
router.get('/folders/:id/children', async (req, res, next) => {
    try {
        const userId = req.user.id;
        const id = Number(req.params.id);

        // 상위폴더 확인 (parentId가 null인 폴더)
        const parentFolder = await prisma.srsfolder.findFirst({
            where: { id, userId, parentId: null },
            select: { id: true, name: true, createdDate: true, date: true, alarmActive: true, learningCurveType: true },
        });
        if (!parentFolder) return fail(res, 404, 'Parent folder not found');

        // 하위 폴더들 조회
        const children = await prisma.srsfolder.findMany({
            where: { userId, parentId: id },
            select: {
                id: true,
                name: true,
                createdDate: true,
                nextReviewDate: true,
                stage: true,
                alarmActive: true,
                learningCurveType: true,
                _count: { select: { srsfolderitem: true } }
            },
            orderBy: [{ id: 'asc' }],
        });

        // 각 하위폴더별 상태별 카드 개수 계산
        const childIds = children.map(c => c.id);
        let childStats = {};
        
        if (childIds.length > 0) {
            // 각 폴더에 대해 상태별 카드 수 계산
            for (const childId of childIds) {
                // 해당 폴더의 학습 곡선 타입 확인
                const childFolder = children.find(c => c.id === childId);
                const isAutonomousMode = childFolder.learningCurveType === 'free';
                
                // 자율모드에서는 lastWrongAt 정보가 필요
                const items = await prisma.srsfolderitem.findMany({
                    where: { folderId: childId },
                    select: {
                        learned: true,
                        wrongCount: true,
                        lastReviewedAt: true,
                        lastWrongAt: true,
                        vocabId: true,
                        srscard: {
                            select: {
                                isOverdue: true,
                                frozenUntil: true,
                                stage: true,
                                isMastered: true,
                                correctTotal: true,
                                wrongTotal: true
                            }
                        }
                    }
                });
                
                console.log(`[DEBUG] Found ${items.length} items in folder ${childId}:`, items.map(item => ({
                    vocabId: item.vocabId,
                    lastReviewedAt: item.lastReviewedAt,
                    lastWrongAt: item.lastWrongAt,
                    learned: item.learned,
                    wrongCount: item.wrongCount
                })));
                
                const now = new Date();
                let reviewWaiting = 0;
                let learningWaiting = 0;
                let wrongAnswers = 0;
                let frozen = 0;
                let stageWaiting = 0;
                let correctWords = 0; // 자율모드용
                let mastered = 0; // 마스터 카드 수
                
                if (isAutonomousMode) {
                    // 자율모드: 마지막 학습 상태 기준 분류
                    items.forEach(item => {
                        // 마지막 학습 상태 결정
                        const hasLastReview = !!item.lastReviewedAt;
                        const hasLastWrong = !!item.lastWrongAt;
                        
                        console.log(`[DEBUG] Item ${item.vocabId}: lastReviewedAt=${item.lastReviewedAt}, lastWrongAt=${item.lastWrongAt}`);
                        
                        let lastState = 'unlearned'; // 기본값: 미학습
                        if (hasLastReview && hasLastWrong) {
                            // 둘 다 있으면 더 늦은 시간 기준
                            lastState = new Date(item.lastWrongAt) >= new Date(item.lastReviewedAt) ? 'wrong' : 'correct';
                            console.log(`[DEBUG] Both dates exist: ${item.lastReviewedAt} vs ${item.lastWrongAt} -> ${lastState}`);
                        } else if (hasLastReview) {
                            lastState = 'correct';
                            console.log(`[DEBUG] Only review date exists -> correct`);
                        } else if (hasLastWrong) {
                            lastState = 'wrong';
                            console.log(`[DEBUG] Only wrong date exists -> wrong`);
                        }
                        
                        console.log(`[DEBUG] Final state for item ${item.vocabId}: ${lastState}`);
                        
                        // 상태별 카운트
                        if (lastState === 'correct') {
                            correctWords++;
                        } else if (lastState === 'wrong') {
                            wrongAnswers++;
                        } else {
                            learningWaiting++; // 미학습
                        }
                    });
                } else {
                    // 일반 SRS 모드: 기존 로직
                    items.forEach(item => {
                        // 마스터 상태 체크 (최우선)
                        if (item.srscard.isMastered) {
                            mastered++;
                            return;
                        }
                        
                        // 동결 상태 체크 (두번째 우선)
                        if (item.srscard.frozenUntil && new Date(item.srscard.frozenUntil) > now) {
                            frozen++;
                            return;
                        }
                        
                        if (item.srscard.isOverdue) {
                            reviewWaiting++; // 복습 대기중
                        } else if (item.learned) {
                            // 정답 상태는 따로 카운트하지 않음
                        } else if (item.wrongCount > 0) {
                            wrongAnswers++; // 오답 대기중
                        } else if (item.srscard.stage > 0) {
                            stageWaiting++; // Stage 대기중
                        } else {
                            learningWaiting++; // 미학습
                        }
                    });
                }
                
                childStats[childId] = {
                    reviewWaiting,
                    learningWaiting,
                    wrongAnswers,
                    frozen,
                    stageWaiting,
                    correctWords, // 자율모드용 추가
                    mastered // 마스터 카드 수
                };
            }
        }

        const mapped = children.map((c) => {
            const stats = childStats[c.id] || {};
            const result = {
                id: c.id,
                name: c.name,
                parentId: id,
                createdDate: c.createdDate,
                nextReviewDate: c.nextReviewDate,
                stage: c.stage,
                alarmActive: c.alarmActive,
                learningCurveType: c.learningCurveType,
                total: c._count.srsfolderitem,
                type: 'child', // 하위폴더 표시
                // 상태별 카드 개수 추가
                reviewWaiting: stats.reviewWaiting || 0,
                learningWaiting: stats.learningWaiting || 0,
                wrongAnswers: stats.wrongAnswers || 0,
                frozen: stats.frozen || 0,
                stageWaiting: stats.stageWaiting || 0,
                correctWords: stats.correctWords || 0,
                mastered: stats.mastered || 0
            };
            console.log(`[DEBUG] Child folder ${c.name} (${c.learningCurveType}):`, {
                total: result.total,
                correctWords: result.correctWords,
                wrongAnswers: result.wrongAnswers,
                learningWaiting: result.learningWaiting,
                stats: stats
            });
            return result;
        });

        return ok(res, { 
            parentFolder, 
            children: mapped,
            canAddCards: false // 상위폴더에는 카드 추가 불가
        });
    } catch (e) { next(e); }
});


router.post('/folders/:rootId/children', auth, async (req, res, next) => {
    try {
        const userId = req.user.id;
        const rootId = Number(req.params.rootId);
        const { name } = req.body;

        if (!name || typeof name !== 'string') {
            return res.status(400).json({ error: 'name(문자열)이 필요합니다.' });
        }

        // 1) 루트 폴더 검증 (본인 소유/parentId NULL)
        const root = await prisma.srsfolder.findFirst({
            where: { id: rootId, userId, parentId: null },
            select: { id: true, date: true, kind: true },
        });
        if (!root) return res.status(404).json({ error: '루트 폴더가 없습니다.' });

        // 2) 해당 루트 밑에서 scheduledOffset 최대값 조회
        const max = await prisma.srsfolder.aggregate({
            _max: { scheduledOffset: true },
            where: {
                userId,
                parentId: root.id,
                date: root.date,
                kind: root.kind, // 보통 'review'
            },
        });
        const nextOffset = (max._max.scheduledOffset ?? 0) + 1;

        // 3) 동일 parentId에서 이름 중복 방지(스키마 @@unique[userId,parentId,name])
        const exists = await prisma.srsfolder.findFirst({
            where: { userId, parentId: root.id, name },
            select: { id: true },
        });
        if (exists) {
            return res.status(409).json({ error: '같은 부모 아래 동일한 이름의 폴더가 이미 존재합니다.' });
        }

        // 4) 하위 폴더 생성 (루트의 date/kind 상속)
        const child = await prisma.srsfolder.create({
            data: {
                userId,
                parentId: root.id,
                name,
                date: root.date,
                kind: root.kind,
                scheduledOffset: nextOffset,
                autoCreated: false,
                alarmActive: true,
                updatedAt: new Date(),
            },
        });

        return res.json({ ok: true, data: child });
    } catch (e) {
        next(e);
    }
});
// POST /srs/folders/:folderId/items
router.post('/folders/:folderId/items', auth, async (req, res, next) => {
    try {
        const userId = req.user.id;
        const folderId = Number(req.params.folderId);
        const body = req.body || {};
        const cardIds = Array.isArray(body.cardIds) ? body.cardIds.map(Number) : [];
        const vocabIds = Array.isArray(body.vocabIds) ? body.vocabIds.map(Number) : [];

        if (!folderId) return res.status(400).json({ error: 'folderId invalid' });
        if (cardIds.length === 0 && vocabIds.length === 0) {
            return res.status(400).json({ error: 'cardIds or vocabIds required' });
        }

        // 폴더 소유 확인
        const folder = await prisma.srsfolder.findFirst({
            where: { id: folderId, userId },
            select: { id: true, date: true, kind: true, parentId: true },
        });
        if (!folder) return res.status(404).json({ error: 'folder not found' });

        // 3단계 구조 강제: 상위폴더(parentId가 null)에는 직접 카드 추가 금지
        if (folder.parentId === null) {
            return res.status(400).json({ 
                error: '상위 폴더에는 직접 카드를 추가할 수 없습니다. 먼저 하위 폴더를 만든 후 카드를 추가해주세요.' 
            });
        }

        const result = await prisma.$transaction(async (tx) => {
            const added = [];

            console.log('[SRS ADD] Adding words (duplicates allowed):', { total: vocabIds.length });

            // 1) vocabIds → 폴더별 독립적인 카드 생성 후 아이템 upsert (중복 허용)
            for (const vid of vocabIds) {
                // 먼저 해당 폴더에 이미 srsfolderitem이 있는지 확인
                const existingFolderItem = await tx.srsfolderitem.findFirst({
                    where: {
                        folderId: folderId,
                        srscard: {
                            userId,
                            itemType: 'vocab',
                            itemId: vid,
                            folderId: folderId
                        }
                    }
                });

                const isReAdding = !existingFolderItem; // 폴더아이템이 없으면 재추가로 판단

                const card = await tx.srscard.upsert({
                    where: {
                        userId_itemType_itemId_folderId: { 
                            userId, 
                            itemType: 'vocab', 
                            itemId: vid,
                            folderId: folderId  // 폴더별 독립성
                        },
                    },
                    update: isReAdding ? {
                        // 재추가 시에만 상태 초기화 (마스터 상태도 리셋)
                        stage: 0,
                        nextReviewAt: null,
                        correctTotal: 0,
                        wrongTotal: 0,
                        cohortDate: null,
                        isFromWrongAnswer: false,
                        isMastered: false,
                        isOverdue: false,
                        masterCycles: 0,
                        masteredAt: null,
                        overdueDeadline: null,
                        overdueStartAt: null,
                        waitingUntil: null,
                        wrongStreakCount: 0,
                        frozenUntil: null
                    } : {
                        // 이미 존재하는 경우 상태 유지 (중복 추가)
                    },
                    create: { 
                        userId, 
                        itemType: 'vocab', 
                        itemId: vid,
                        folderId: folderId,  // 폴더별 독립성
                        stage: 0,
                        nextReviewAt: null // 새로 생성된 카드는 즉시 학습 가능
                    },
                    select: { id: true, itemType: true, itemId: true },
                });

                await tx.srsfolderitem.upsert({
                    where: { folderId_cardId: { folderId, cardId: card.id } },
                    update: {},
                    create: {
                        folderId,
                        cardId: card.id,
                        vocabId: card.itemType === 'vocab' ? card.itemId : null,
                        learned: false,
                        wrongCount: 0,
                    },
                });
                added.push({ cardId: card.id });
            }

            // 2) cardIds → 존재/소유 검증 후 아이템 upsert
            if (cardIds.length) {
                const cards = await tx.srscard.findMany({
                    where: { id: { in: cardIds }, userId },
                    select: { id: true, itemType: true, itemId: true },
                });
                if (cards.length === 0) throw Object.assign(new Error('cards not found'), { status: 404 });

                for (const c of cards) {
                    await tx.srsfolderitem.upsert({
                        where: { folderId_cardId: { folderId, cardId: c.id } },
                        update: {},
                        create: {
                            folderId,
                            cardId: c.id,
                            vocabId: c.itemType === 'vocab' ? c.itemId : null,
                            learned: false,
                            wrongCount: 0,
                        },
                    });
                    added.push({ cardId: c.id });
                }
            }

            return { 
                addedCount: added.length, 
                items: added
            };
        });

        res.json({ ok: true, data: result });
    } catch (e) {
        if (e.status) return res.status(e.status).json({ error: e.message });
        next(e);
    }
});


// server/routes/srs.js 에 추가될 코드

// POST /srs/folders/:folderId/items/bulk-delete
// server/routes/srs.js

// POST /srs/folders/:folderId/items/bulk-delete
router.post('/folders/:folderId/items/bulk-delete', async (req, res, next) => {
    try {
        const userId = req.user.id;
        const folderId = Number(req.params.folderId);
        // ✅ 요청 본문에서 itemIds와 permanent 옵션을 함께 받습니다.
        const { itemIds, permanent } = req.body;
        
        console.log('[BULK DELETE] Request:', { userId, folderId, itemIds, permanent });

        // ... (기존 유효성 검사 및 폴더 소유권 확인) ...

        // ✅ SrsFolderItem ID로 실제 SRSCard ID를 조회합니다.
        const itemsToDelete = await prisma.srsfolderitem.findMany({
            where: { id: { in: itemIds }, folderId: folderId },
            select: { id: true, cardId: true },
        });

        console.log('[BULK DELETE] Items found to delete:', itemsToDelete);

        if (itemsToDelete.length === 0) {
            console.log('[BULK DELETE] No items found to delete');
            return ok(res, { count: 0 });
        }

        const folderItemIds = itemsToDelete.map(item => item.id);
        const cardIdsToDelete = itemsToDelete.map(item => item.cardId);

        // --- 트랜잭션으로 안전하게 처리 ---
        await prisma.$transaction(async (tx) => {
            // ✅ 폴더별 독립성을 위해 srsfolderitem만 삭제하고 전역 카드는 유지
            const result = await tx.srsfolderitem.deleteMany({
                where: { id: { in: folderItemIds } },
            });
            
            console.log('[BULK DELETE] SrsFolderItem deleteMany result:', result);

            // ✅ 삭제되는 단어들의 vocabId 조회
            const cardsToDelete = await tx.srscard.findMany({
                where: { id: { in: cardIdsToDelete } },
                select: { itemId: true },
            });
            
            const vocabIdsToDelete = cardsToDelete.map(card => card.itemId);
            
            // ✅ 해당 폴더의 오답노트도 함께 삭제
            if (vocabIdsToDelete.length > 0) {
                const wrongAnswersDeleted = await tx.wronganswer.deleteMany({
                    where: { 
                        userId,
                        folderId,
                        vocabId: { in: vocabIdsToDelete }
                    },
                });
                
                console.log('[BULK DELETE] Wrong answers deleted:', wrongAnswersDeleted.count);
            }
        });

        return ok(res, { count: itemsToDelete.length, permanent });
    } catch (e) {
        next(e);
    }
});
// DELETE /srs/folders/:id  (루트/하위 모두 허용)  — 하위와 아이템까지 함께 삭제
// DELETE /srs/folders/:id  — 단일계층 삭제
router.delete('/folders/:id', async (req, res, next) => {
    try {
        const userId = req.user.id;
        const id = Number(req.params.id);
        if (!Number.isFinite(id)) return fail(res, 400, 'invalid id');

        const exists = await prisma.srsfolder.findFirst({ where: { id, userId }, select: { id: true } });
        if (!exists) return fail(res, 404, 'Folder not found');

        await prisma.$transaction(async (tx) => {
            // 폴더 아이템들 가져오기 (오답노트 정리를 위해)
            const srsfolderitem = await tx.srsfolderitem.findMany({
                where: { folderId: id },
                select: { vocabId: true }
            });
            const vocabIds = srsfolderitem.map(item => item.vocabId).filter(Boolean);
            
            // 폴더 아이템들과 폴더 삭제
            await tx.srsfolderitem.deleteMany({ where: { folderId: id } });
            if (tx.srsfolder && typeof tx.srsfolder.delete === 'function') {
                await tx.srsfolder.delete({ where: { id } });
            } else {
                console.error('tx.srsfolder.delete is not available:', typeof tx.srsfolder);
                throw new Error('Prisma transaction object is invalid');
            }
            
            // ✅ 해당 폴더의 오답노트 삭제 (폴더별 독립성)
            // vocabIds가 있는 경우와 없는 경우 모두 처리
            const wrongAnswersDeleted = await tx.wronganswer.deleteMany({
                where: { 
                    userId,
                    folderId: id
                }
            });
            console.log(`[FOLDER DELETE] Deleted ${wrongAnswersDeleted.count} wrong answers for folder ${id}`);
            
            // 추가 안전장치: 정리 서비스로 고아 오답노트 정리
            try {
                const { cleanupWrongAnswersForDeletedFolder } = require('../services/wrongAnswerCleanupService');
                await cleanupWrongAnswersForDeletedFolder(id, userId);
            } catch (cleanupError) {
                console.warn(`[FOLDER DELETE] Cleanup service warning for folder ${id}:`, cleanupError.message);
                // 정리 서비스 오류는 치명적이지 않음
            }
        });

        return ok(res, { deleted: true, id });
    } catch (e) {
        console.error('DELETE /srs/folders/:id failed:', e);
        return fail(res, 500, 'Internal Server Error');
    }
});


// POST /srs/folders/bulk-delete  { ids: number[] }
router.post('/folders/bulk-delete', async (req, res, next) => {
    try {
        const userId = req.user.id;
        const ids = (req.body?.ids || []).map(Number).filter(Boolean);
        if (!ids.length) return fail(res, 400, 'ids is required');

        await prisma.$transaction(async (tx) => {
            let allVocabIds = [];
            
            for (const id of ids) {
                const found = await tx.srsfolder.findFirst({ where: { id, userId }, select: { id: true } });
                if (!found) continue;
                
                // 삭제할 폴더들의 모든 아이템 수집
                const children = await tx.srsfolder.findMany({ where: { parentId: id }, select: { id: true } });
                const childIds = children.map((c) => c.id);
                const allFolderIds = [id, ...childIds];
                
                const srsfolderitem = await tx.srsfolderitem.findMany({
                    where: { folderId: { in: allFolderIds } },
                    select: { vocabId: true }
                });
                const vocabIds = srsfolderitem.map(item => item.vocabId).filter(Boolean);
                allVocabIds.push(...vocabIds);
                
                // 해당 폴더들의 오답노트 삭제 (폴더별 독립성)
                if (vocabIds.length > 0) {
                    const wrongAnswersDeleted = await tx.wronganswer.deleteMany({
                        where: { 
                            userId,
                            folderId: { in: allFolderIds },
                            vocabId: { in: vocabIds }
                        }
                    });
                    console.log(`[BULK FOLDER DELETE] Deleted ${wrongAnswersDeleted.count} wrong answers for folders:`, allFolderIds);
                }
                
                // 폴더 삭제
                if (childIds.length) {
                    await tx.srsfolderitem.deleteMany({ where: { folderId: { in: childIds } } });
                    await tx.srsfolder.deleteMany({ where: { id: { in: childIds } } });
                }
                await tx.srsfolderitem.deleteMany({ where: { folderId: id } });
                await tx.srsfolder.delete({ where: { id } });
            }
            
            // 모든 삭제된 단어들에 대해 오답노트 정리
            if (allVocabIds.length > 0) {
                const uniqueVocabIds = [...new Set(allVocabIds)];
                const remainingSrsCards = await tx.srscard.findMany({
                    where: {
                        userId: userId,
                        itemType: 'vocab',
                        itemId: { in: uniqueVocabIds },
                        srsfolderitem: {
                            some: {
                                srsfolder: { userId: userId }
                            }
                        }
                    },
                    select: { itemId: true }
                });
                
                const remainingVocabIds = new Set(remainingSrsCards.map(card => card.itemId));
                const orphanedVocabIds = uniqueVocabIds.filter(vid => !remainingVocabIds.has(vid));
                
                if (orphanedVocabIds.length > 0) {
                    const deletedCount = await tx.wronganswer.deleteMany({
                        where: {
                            userId: userId,
                            vocabId: { in: orphanedVocabIds }
                        }
                    });
                    console.log(`[BULK FOLDER DELETE] Cleaned up ${deletedCount.count} orphaned wrong answers for vocabs:`, orphanedVocabIds);
                }
            }
        });

        return ok(res, { deleted: ids.length });
    } catch (e) { next(e); }
});

// POST /srs/wrong-answers/cleanup — 고아 오답노트 정리 (폴더 없는 단어들)
router.post('/wrong-answers/cleanup', async (req, res, next) => {
    try {
        const userId = req.user.id;
        
        // 먼저 사용자의 SRS 폴더가 있는지 확인
        const userSrsFolders = await prisma.srsfolder.findMany({
            where: { userId: userId },
            select: { id: true, name: true }
        });
        
        console.log(`[CLEANUP] User has ${userSrsFolders.length} SRS folders:`, userSrsFolders.map(f => f.name));
        
        if (userSrsFolders.length === 0) {
            // SRS 폴더가 없으면 모든 오답노트 삭제
            const deletedCount = await prisma.wronganswer.deleteMany({
                where: { userId: userId }
            });
            
            console.log(`[CLEANUP] No SRS folders found, deleted all ${deletedCount.count} wrong answers`);
            return ok(res, { 
                cleaned: deletedCount.count, 
                message: 'All wrong answers deleted (no SRS folders)' 
            });
        }
        
        // SRS 폴더가 있으면 기존 로직 사용
        const activeSrsCards = await prisma.srscard.findMany({
            where: {
                userId: userId,
                itemType: 'vocab',
                srsfolderitem: {
                    some: {
                        srsfolder: { userId: userId }
                    }
                }
            },
            select: { itemId: true }
        });
        
        const activeVocabIds = new Set(activeSrsCards.map(card => card.itemId));
        console.log(`[CLEANUP] Found ${activeVocabIds.size} active vocab IDs in SRS folders`);
        
        // 모든 오답노트 조회
        const allWrongAnswers = await prisma.wronganswer.findMany({
            where: { userId: userId },
            select: { id: true, vocabId: true }
        });
        
        console.log(`[CLEANUP] Found ${allWrongAnswers.length} wrong answers total`);
        
        // 활성 폴더에 없는 오답노트 찾기
        const orphanedWrongAnswers = allWrongAnswers.filter(wa => !activeVocabIds.has(wa.vocabId));
        
        if (orphanedWrongAnswers.length > 0) {
            const deletedCount = await prisma.wronganswer.deleteMany({
                where: {
                    userId: userId,
                    vocabId: { in: orphanedWrongAnswers.map(wa => wa.vocabId) }
                }
            });
            
            console.log(`[CLEANUP] Deleted ${deletedCount.count} orphaned wrong answers`);
            return ok(res, { 
                cleaned: deletedCount.count, 
                orphanedVocabIds: orphanedWrongAnswers.map(wa => wa.vocabId) 
            });
        } else {
            console.log(`[CLEANUP] No orphaned wrong answers found`);
            return ok(res, { cleaned: 0, orphanedVocabIds: [] });
        }
        
    } catch (e) {
        console.error('POST /srs/wrong-answers/cleanup failed:', e);
        return fail(res, 500, 'Failed to cleanup wrong answers');
    }
});

// GET /srs/folders/picker  → 루트 폴더(날짜 폴더)만 가볍게
// server/routes/srs.js  (기존 picker 라우트 확장)
router.get('/folders/picker', async (req, res, next) => {
    try {
        const userId = req.user.id;
        const flatten = String(req.query.flatten || '').toLowerCase();

        if (flatten === 'sub') {
            const subs = await prisma.srsfolder.findMany({
                where: { userId, parentId: { not: null } },
                orderBy: [{ date: 'desc' }, { id: 'desc' }],
                select: { id: true, name: true, parentId: true, date: true }
            });
            return ok(res, subs);
        }

        // (기존 동작: 루트 등 목록)
        const data = await prisma.srsfolder.findMany({
            where: { userId },
            orderBy: [{ date: 'desc' }, { id: 'desc' }],
            select: { id: true, name: true, date: true, parentId: true, alarmActive: true }
        });
        return ok(res, data);
    } catch (e) { next(e); }
});


// GET /srs/folders/:id/children-lite  → 픽커에서 펼칠 때 쓰는 가벼운 하위 목록
// GET /srs/folders/:rootId/children-lite
router.get('/folders/:rootId/children-lite', auth, async (req, res, next) => {
    try {
        const userId = req.user.id;
        const rootId = Number(req.params.rootId);

        const root = await prisma.srsfolder.findFirst({
            where: { id: rootId, userId, parentId: null },
            select: { id: true, date: true, kind: true }
        });
        if (!root) return res.status(404).json({ error: '루트 폴더 없음' });

        const children = await prisma.srsfolder.findMany({
            where: { userId, parentId: root.id, date: root.date, kind: root.kind },
            select: { id: true, name: true, scheduledOffset: true, nextAlarmAt: true },
            orderBy: [{ scheduledOffset: 'asc' }, { id: 'asc' }],
        });

        const ids = children.map(c => c.id);
        const counts = ids.length
            ? await prisma.srsfolderitem.groupBy({
                by: ['folderId'],
                where: { folderId: { in: ids }, learned: false },
                _count: { _all: true }
            })
            : [];

        const countMap = new Map(counts.map(c => [c.folderId, c._count._all]));
        const data = children.map(c => ({
            id: c.id,
            name: c.name,
            scheduledOffset: c.scheduledOffset,
            nextAlarmAt: c.nextAlarmAt,
            dueCount: countMap.get(c.id) ?? 0,
        }));

        res.json({ ok: true, data });
    } catch (e) { next(e); }
});


// ────────────────────────────────────────────────────────────
// 큐 API (폴더 기반 + 레거시 겸용)
// ────────────────────────────────────────────────────────────

// GET /srs/queue?folderId=123&limit=20&selectedItems=1,2,3
router.get('/queue', async (req, res) => {
    try {
        const userId = req.user.id;
        const folderId = req.query.folderId ? Number(req.query.folderId) : null;
        const selectedItems = req.query.selectedItems ? req.query.selectedItems.split(',').map(Number).filter(Boolean) : null;
        const allOverdue = req.query.all === 'true';

        if (allOverdue && selectedItems) {
            // 전체 overdue 카드 퀴즈 - 선택된 vocabId들로 가상 폴더 아이템 생성
            const vocabIds = selectedItems;
            
            // 각 vocabId에 대한 SRS 카드와 폴더 아이템 정보 조회
            const overdueCards = await getAvailableCardsForReview(userId);
            
            // 선택된 vocabId에 해당하는 카드들만 필터링
            const filteredCards = overdueCards.filter(card => {
                const cardVocabId = card.srsfolderitem[0]?.vocabId || card.srsfolderitem[0]?.vocab?.id;
                return vocabIds.includes(cardVocabId);
            });
            
            if (!filteredCards.length) return ok(res, []);
            
            // vocab 정보 가져오기 (언어 감지용)
            const vocabMap = new Map();
            if (vocabIds.length > 0) {
                const vocabs = await prisma.vocab.findMany({
                    where: { id: { in: vocabIds } },
                    include: {
                        dictentry: true,
                        translations: {
                            where: { languageId: 2 } // Korean
                        }
                    }
                });
                vocabs.forEach(v => vocabMap.set(v.id, v));
            }

            // Generate quiz items
            const queue = await generateMcqQuizItems(prisma, userId, vocabIds);

            // Inject card information for frontend (SRS 폴더와 동일한 구조)
            const queueWithCardInfo = queue.map(q => {
                const card = filteredCards.find(c => 
                    (c.srsfolderitem[0]?.vocabId || c.srsfolderitem[0]?.vocab?.id) === q.vocabId
                );
                const folderItem = card?.srsfolderitem[0];
                const vocabData = vocabMap.get(q.vocabId);

                return {
                    ...q,
                    folderId: folderItem?.folderId || null,
                    cardId: card?.id || null,
                    isLearned: folderItem?.learned || false,
                    wrongCount: folderItem?.wrongCount || 0,
                    stage: card?.stage || 0,
                    nextReviewAt: card?.nextReviewAt,
                    hasBeenAnswered: (card?.correctTotal || 0) + (card?.wrongTotal || 0) > 0,
                    isOverdue: card?.isOverdue || false,
                    overdueDeadline: card?.overdueDeadline,
                    waitingUntil: card?.waitingUntil,
                    isFromWrongAnswer: card?.isFromWrongAnswer || false,
                    // vocab 정보 추가 (언어 감지용)
                    vocab: vocabData || q.vocab
                };
            });
            
            return ok(res, queueWithCardInfo);
        }

        if (folderId) {
            // 선택된 아이템이 있으면 해당 아이템만, 없으면 모든 아이템
            const whereCondition = { 
                folderId, 
                srsfolder: { userId }
            };
            
            // 선택된 아이템이 있으면 해당 아이템만 필터링
            if (selectedItems && selectedItems.length > 0) {
                // 숫자 크기로 folderItemId인지 vocabId인지 구분
                // vocabId는 보통 큰 수, folderItemId는 작은 수
                // 더 정확하게는 실제 존재하는지 확인
                const testItem = await prisma.srsfolderitem.findFirst({
                    where: { 
                        folderId,
                        id: selectedItems[0]
                    },
                    select: { id: true }
                });
                
                if (testItem) {
                    // folderItemId로 필터링
                    whereCondition.id = { in: selectedItems };
                    console.log(`[SRS QUEUE] Filtering by folderItemIds: ${selectedItems.join(',')}`);
                } else {
                    // vocabId로 필터링 (오답노트에서 오는 경우)
                    whereCondition.vocabId = { in: selectedItems };
                    console.log(`[SRS QUEUE] Filtering by vocabIds: ${selectedItems.join(',')}`);
                }
            }
            
            const items = await prisma.srsfolderitem.findMany({
                where: whereCondition,
                select: { 
                    id: true, 
                    cardId: true,
                    vocabId: true,
                    learned: true,
                    wrongCount: true,
                    srscard: { 
                        select: { 
                            itemId: true, 
                            stage: true, 
                            nextReviewAt: true,
                            correctTotal: true,
                            wrongTotal: true
                        } 
                    }
                },
                orderBy: [
                    { learned: 'asc' },  // 미학습 우선
                    { wrongCount: 'desc' }, // 오답 많은 것 우선
                    { id: 'asc' }
                ],
            });
            if (!items.length) return ok(res, []);

            // vocabId -> cardId 매핑 생성
            const vocabToCardMap = new Map();
            items.forEach(it => {
                const vocabId = it.vocabId ?? it.card?.itemId;
                if (vocabId) {
                    vocabToCardMap.set(vocabId, it.cardId);
                }
            });
            
            const vocabIds = items.map((it) => it.vocabId ?? it.card?.itemId).filter(Boolean);

            // 첫 번째 vocab으로 언어 감지
            let detectedLanguage = 'en';
            if (vocabIds.length > 0) {
                const firstVocab = await prisma.vocab.findFirst({
                    where: { id: vocabIds[0] },
                    select: {
                        levelJLPT: true,
                        source: true,
                        dictentry: {
                            select: {
                                examples: true
                            }
                        }
                    }
                });
                if (firstVocab) {
                    detectedLanguage = detectLanguage(firstVocab);
                    console.log(`[SRS QUEUE] Detected language: ${detectedLanguage} for vocabIds: ${vocabIds.slice(0, 5).join(',')}`);
                }
            }

            // Generate a multiple-choice quiz from the folder's vocab IDs [211]
            const queue = await generateMcqQuizItems(prisma, userId, vocabIds);
            // 각 vocab 정보 가져오기 (언어 감지를 위해)
            const vocabMap = new Map();
            if (vocabIds.length > 0) {
                const vocabs = await prisma.vocab.findMany({
                    where: { id: { in: vocabIds } },
                    include: {
                        dictentry: true,
                        translations: {
                            where: { languageId: 2 } // Korean
                        }
                    }
                });
                vocabs.forEach(v => vocabMap.set(v.id, v));
            }

            // Inject folderId and cardId into each quiz item for the frontend's answer submission
            const queueWithFolderId = queue.map(q => {
                const item = items.find(it => (it.vocabId ?? it.card?.itemId) === q.vocabId);
                const vocabData = vocabMap.get(q.vocabId);

                return {
                    ...q,
                    folderId,
                    cardId: vocabToCardMap.get(q.vocabId) || null,
                    isLearned: item?.learned || false,
                    wrongCount: item?.wrongCount || 0,
                    stage: item?.card?.stage || 0,
                    nextReviewAt: item?.card?.nextReviewAt,
                    hasBeenAnswered: (item?.card?.correctTotal || 0) + (item?.card?.wrongTotal || 0) > 0,
                    // 동결 상태 정보 추가
                    isFrozen: item?.card?.isFrozen || false,
                    frozenUntil: item?.card?.frozenUntil,
                    isOverdue: item?.card?.isOverdue || false,
                    overdueDeadline: item?.card?.overdueDeadline,
                    waitingUntil: item?.card?.waitingUntil,
                    isFromWrongAnswer: item?.card?.isFromWrongAnswer || false,
                    // vocab 정보 추가 (언어 감지용)
                    vocab: vocabData || q.vocab
                };
            });
            
            return ok(res, queueWithFolderId);

        }

        // 레거시 큐 — 현재 활성 폴더에 속한 카드만
        const limit = Math.min(Number(req.query.limit || 20), 100);
        const cards = await prisma.srscard.findMany({
            where: { 
                userId, 
                itemType: 'vocab', 
                nextReviewAt: { lte: new Date() },
                // 현재 어떤 폴더에든 속해있는 카드만
                srsfolderitem: {
                    some: {
                        srsfolder: {
                            userId: userId
                        }
                    }
                }
            },
            orderBy: { nextReviewAt: 'asc' },
            take: limit,
            select: { itemId: true },
        });
        if (!cards.length) return ok(res, []);
        const vocabIds = cards.map((c) => c.itemId);
        const queue = await generateMcqQuizItems(prisma, userId, vocabIds);
        return ok(res, queue);
    } catch (e) {
        console.error('GET /srs/queue error:', e);
        return fail(res, 500, 'Internal Server Error');
    }
});

// ────────────────────────────────────────────────────────────
// 대시보드(루트 폴더 요약)
// ────────────────────────────────────────────────────────────
router.get('/dashboard', async (req, res) => {
    try {
        const userId = req.user.id;
        const roots = await prisma.srsfolder.findMany({
            where: { userId, parentId: null },
            orderBy: [{ date: 'desc' }, { id: 'desc' }],
            include: { items: { select: { learned: true, wrongCount: true } } },
        });

        const data = roots.map((r) => ({
            id: r.id,
            name: r.name,
            date: r.date, // 프론트에서 dayjs.tz로 표시
            alarmActive: r.alarmActive,
            total: r.items.length,
            completed: r.items.filter((i) => i.learned).length,
            incorrect: r.items.filter((i) => (i.wrongCount ?? 0) > 0).length,
        }));

        return ok(res, data);
    } catch (e) {
        console.error('GET /srs/dashboard failed:', e);
        return fail(res, 500, '대시보드 데이터를 불러오는 데 실패했습니다.');
    }
});

// ────────────────────────────────────────────────────────────
// 레거시 호환 API들 (그대로 유지)
// ────────────────────────────────────────────────────────────

router.get('/quiz', async (req, res) => {
    try {
        const { date } = req.query;
        if (!date) return fail(res, 400, '날짜를 지정해야 합니다.');
        const startOfDay = dayjs.tz(date, KST).startOf('day').toDate();
        const endOfDay = dayjs.tz(date, KST).endOf('day').toDate();

        const cards = await prisma.srscard.findMany({
            where: { userId: req.user.id, itemType: 'vocab', nextReviewAt: { gte: startOfDay, lte: endOfDay } },
            select: { itemId: true },
        });
        const vocabIds = cards.map((c) => c.itemId);
        const quizItems = await generateMcqQuizItems(prisma, req.user.id, vocabIds);
        return ok(res, quizItems);
    } catch (e) { return fail(res, 500, '퀴즈 생성 실패'); }
});

router.post('/create-many', async (req, res) => {
    const { vocabIds } = req.body || {};
    if (!Array.isArray(vocabIds) || vocabIds.length === 0) return fail(res, 400, 'vocabIds must be non-empty');
    const userId = req.user.id;

    const existing = await prisma.srscard.findMany({
        where: { userId, itemId: { in: vocabIds }, itemType: 'vocab' },
        select: { itemId: true },
    });
    const set = new Set(existing.map((e) => e.itemId));
    const toCreate = vocabIds
        .map(Number)
        .filter(Boolean)
        .filter((id) => !set.has(id))
        .map((vocabId) => ({ userId, itemType: 'vocab', itemId: vocabId, stage: 0, nextReviewAt: new Date() }));
    if (!toCreate.length) return fail(res, 409, '이미 SRS에 추가된 단어입니다.');

    const r = await prisma.srscard.createMany({ data: toCreate });
    return ok(res, { count: r.count });
});

router.get('/all-cards', async (req, res) => {
    try {
        const cards = await prisma.srscard.findMany({
            where: { userId: req.user.id, itemType: 'vocab' },
            select: { id: true, itemId: true, nextReviewAt: true, stage: true },
        });
        if (!cards.length) return ok(res, []);

        const vocabIds = cards.map((c) => c.itemId);
        const vocabs = await prisma.vocab.findMany({
            where: { id: { in: vocabIds } },
            include: {
                dictentry: true,
                translations: {
                    where: { languageId: 2 }, // Korean translations
                    select: { translation: true }
                }
            }
        });
        const map = new Map(vocabs.map((v) => [v.id, v]));

        const result = cards
            .map((c) => {
                const vocab = map.get(c.itemId);
                let ko_gloss = null;

                if (vocab) {
                    const isJapanese = vocab?.languageId === 3;

                    // First try Korean translation from VocabTranslation table
                    if (vocab.translations && vocab.translations.length > 0) {
                        ko_gloss = vocab.translations[0].translation;
                    }
                    // For Japanese words, try multiple fallback options
                    else if (isJapanese && vocab.dictentry?.examples) {
                        // Try koExample from dictentry examples object
                        if (typeof vocab.dictentry.examples === 'object' && vocab.dictentry.examples.koExample) {
                            ko_gloss = vocab.dictentry.examples.koExample;
                        }
                        // Try parsing string format examples
                        else if (typeof vocab.dictentry.examples === 'string') {
                            try {
                                const parsedExamples = JSON.parse(vocab.dictentry.examples);
                                if (parsedExamples.koExample) {
                                    ko_gloss = parsedExamples.koExample;
                                }
                            } catch (e) {
                                console.warn('Failed to parse dictentry.examples for Japanese vocab:', vocab.lemma, e);
                            }
                        }
                    }
                    // Fallback for English words (array format)
                    else if (!isJapanese && Array.isArray(vocab.dictentry?.examples)) {
                        const glossExample = vocab.dictentry.examples.find((ex) => ex?.kind === 'gloss');
                        ko_gloss = glossExample?.ko;
                    }
                }

                // Add Japanese-specific fields if this is a Japanese word
                const isJapanese = vocab?.languageId === 3 || vocab?.dictentry?.ipa;
                const result = {
                    cardId: c.id,
                    vocabId: c.itemId,
                    lemma: vocab?.lemma,
                    ko_gloss: ko_gloss,
                    nextReviewAt: c.nextReviewAt,
                    stage: c.stage,
                    ipa: vocab?.dictentry?.ipa,
                    ipaKo: vocab?.dictentry?.ipaKo,
                };

                if (isJapanese) {
                    // Parse examples for Japanese words
                    let examples = {};
                    if (vocab.dictentry?.examples && typeof vocab.dictentry.examples === 'object') {
                        examples = vocab.dictentry.examples;
                    }

                    result.kana = vocab.dictentry?.ipa || examples.kana || '';
                    result.romaji = vocab.dictentry?.ipaKo || examples.romaji || '';
                    result.kanji = examples.kanji || null;
                    result.levelJLPT = vocab.levelJLPT || null;
                }

                return result;
            })
            .filter((x) => x.lemma);

        return ok(res, result);
    } catch (e) {
        console.error('GET /srs/all-cards error:', e);
        return fail(res, 500, 'Internal Server Error');
    }
});

router.post('/replace-deck', async (req, res) => {
    const { vocabIds } = req.body || {};
    if (!Array.isArray(vocabIds) || !vocabIds.length) return fail(res, 400, 'vocabIds must be non-empty');
    const userId = req.user.id;

    const unique = [...new Set(vocabIds.map(Number).filter(Boolean))];
    try {
        await prisma.$transaction(async (tx) => {
            await tx.srscard.deleteMany({ where: { userId, itemType: 'vocab' } });
            if (unique.length) {
                await tx.srscard.createMany({
                    data: unique.map((id) => ({ userId, itemType: 'vocab', itemId: id, stage: 0, nextReviewAt: new Date() })),
                });
            }
        });
        return ok(res, { message: `replaced deck with ${unique.length} cards` });
    } catch (e) {
        console.error('POST /srs/replace-deck failed:', e);
        return fail(res, 500, 'Internal Server Error');
    }
});

// ────────────────────────────────────────────────────────────
// 폴더 완료 및 streak/오답노트 API
// ────────────────────────────────────────────────────────────

// POST /srs/folders/:id/complete — 폴더 완료 처리 및 다음 복습 생성
router.post('/folders/:id/complete', async (req, res, next) => {
    try {
        const userId = req.user.id;
        const folderId = Number(req.params.id);
        
        const result = await completeFolderAndScheduleNext(folderId, userId);
        
        const responseData = {
            message: result.message,
            completedFolder: result.completedFolder.name,
            isMastered: result.completedFolder.isMastered,
            completionCount: result.completedFolder.completionCount
        };
        
        if (result.nextFolder) {
            responseData.nextFolder = result.nextFolder.name;
            responseData.nextReviewDate = result.nextReviewDate;
            responseData.nextStage = result.nextFolder.stage;
        }
        
        return ok(res, responseData);
    } catch (e) {
        if (e.message === 'Folder not found') {
            return fail(res, 404, 'Folder not found');
        }
        if (e.message === 'All items must be completed before finishing the folder') {
            return fail(res, 400, 'All items must be completed before finishing the folder');
        }
        next(e);
    }
});

// POST /srs/folders/:id/restart — 마스터된 폴더 재시작
router.post('/folders/:id/restart', async (req, res, next) => {
    try {
        const userId = req.user.id;
        const folderId = Number(req.params.id);
        
        const result = await restartMasteredFolder(folderId, userId);
        
        return ok(res, result);
    } catch (e) {
        if (e.message === 'Mastered folder not found') {
            return fail(res, 404, 'Mastered folder not found');
        }
        next(e);
    }
});

// POST /srs/folders/:id/enable-learning — 완료된 폴더를 재학습 가능하게 설정
router.post('/folders/:id/enable-learning', async (req, res, next) => {
    try {
        const userId = req.user.id;
        const folderId = Number(req.params.id);
        
        const folder = await prisma.srsfolder.findFirst({
            where: { id: folderId, userId },
            include: { items: true }
        });
        
        if (!folder) {
            return fail(res, 404, 'Folder not found');
        }
        
        // 폴더를 학습 가능 상태로 설정하되, 복습일은 변경하지 않음
        await prisma.srsfolder.update({
            where: { id: folderId },
            data: {
                alarmActive: true, // 알림 활성화
                // stage와 nextReviewDate는 그대로 유지
            }
        });
        
        // 모든 아이템을 미학습 상태로 리셋하여 다시 학습 가능하게 함
        await prisma.srsfolderitem.updateMany({
            where: { folderId: folderId },
            data: { learned: false }
        });
        
        return ok(res, {
            message: '폴더가 재학습 가능 상태로 설정되었습니다. 복습일은 변경되지 않습니다.',
            folderId: folderId,
            folderName: folder.name
        });
    } catch (e) {
        next(e);
    }
});

// GET /srs/streak — 사용자 streak 정보 조회
router.get('/streak', async (req, res, next) => {
    try {
        const userId = req.user.id;
        const streakInfo = await getUserStreakInfo(userId);
        
        return ok(res, streakInfo);
    } catch (e) {
        next(e);
    }
});

// POST /srs/clean-invalid-reviews — 잘못된 대기 중 학습 기록 정리 (개발/테스트 용도)
router.post('/clean-invalid-reviews', async (req, res, next) => {
    try {
        const userId = req.user.id;
        
        // 오늘 날짜 범위 계산
        const today = dayjs().tz(KST).startOf('day');
        const startOfDay = today.toDate();
        const endOfDay = today.endOf('day').toDate();
        
        // 오늘 날짜에 lastReviewedAt이 있는데, 해당 카드가 대기 중 상태인 아이템들 찾기
        const invalidItems = await prisma.srsfolderitem.findMany({
            where: {
                srscard: {
                    userId: userId,
                    itemType: 'vocab'
                },
                lastReviewedAt: {
                    gte: startOfDay,
                    lte: endOfDay
                }
            },
            include: {
                srscard: {
                    select: {
                        id: true,
                        stage: true,
                        waitingUntil: true,
                        isOverdue: true
                    }
                }
            }
        });
        
        // 현재 시간 기준으로 대기 중인 카드들 필터링
        const now = new Date();
        const toClean = invalidItems.filter(item => {
            const card = item.srscard;
            // 대기 중인 카드 (waitingUntil이 미래이고 overdue가 아닌 카드)
            return card.waitingUntil && 
                   new Date(card.waitingUntil) > now && 
                   !card.isOverdue;
        });
        
        console.log(`[CLEAN INVALID] Found ${toClean.length} invalid review records to clean:`,
            toClean.map(item => ({
                cardId: item.srscard.id,
                lastReviewedAt: item.lastReviewedAt,
                waitingUntil: item.srscard.waitingUntil
            }))
        );
        
        if (toClean.length > 0) {
            // lastReviewedAt을 null로 설정
            const cardIds = toClean.map(item => item.cardId);
            await prisma.srsfolderitem.updateMany({
                where: {
                    cardId: { in: cardIds }
                },
                data: {
                    lastReviewedAt: null
                }
            });
        }
        
        return ok(res, {
            message: `${toClean.length}개의 잘못된 학습 기록을 정리했습니다.`,
            cleanedItems: toClean.length
        });
        
    } catch (e) {
        console.error('POST /srs/clean-invalid-reviews failed:', e);
        return fail(res, 500, 'Failed to clean invalid reviews');
    }
});

// POST /srs/streak/reset — 오늘의 학습 카운트 초기화 (개발/테스트 용도)
router.post('/streak/reset', async (req, res, next) => {
    try {
        const userId = req.user.id;
        
        // 사용자의 오늘 학습 카운트 리셋
        await prisma.user.update({
            where: { id: userId },
            data: {
                dailyQuizCount: 0,
                lastQuizDate: null
            }
        });
        
        // 오늘 날짜의 잘못된 lastReviewedAt 기록들을 정리
        const today = dayjs().tz(KST).startOf('day');
        const startOfDay = today.toDate();
        const endOfDay = today.endOf('day').toDate();
        
        // 오늘 날짜에 lastReviewedAt이 있는데 대기 중 상태인 카드들 찾아서 정리
        const result = await prisma.$executeRaw`
            UPDATE srsfolderitem 
            SET lastReviewedAt = NULL 
            WHERE lastReviewedAt >= ${startOfDay} 
            AND lastReviewedAt <= ${endOfDay}
            AND cardId IN (
                SELECT id FROM srscard 
                WHERE userId = ${userId} 
                AND waitingUntil > NOW() 
                AND isOverdue = false
            )
        `;
        
        console.log(`[STREAK RESET] Reset daily quiz count and cleaned ${result} invalid lastReviewedAt records for user ${userId}`);
        
        return ok(res, { 
            message: `오늘의 학습 카운트가 초기화되고 ${result}개의 잘못된 학습 기록을 정리했습니다.`,
            dailyQuizCount: 0,
            cleanedRecords: Number(result)
        });
    } catch (e) {
        console.error('POST /srs/streak/reset failed:', e);
        return fail(res, 500, 'Failed to reset daily quiz count');
    }
});

// ────────────────────────────────────────────────────────────
// 오답노트 API
// ────────────────────────────────────────────────────────────

// GET /srs/wrong-answers — 오답노트 목록 조회
router.get('/wrong-answers', async (req, res, next) => {
    try {
        const userId = req.user.id;
        const includeCompleted = req.query.includeCompleted === 'true';
        
        // 실제 오답노트 데이터 조회
        const wrongAnswers = await prisma.wronganswer.findMany({
            where: {
                userId,
                isCompleted: includeCompleted ? undefined : false
            },
            include: {
                vocab: {
                    include: {
                        dictentry: true
                    }
                },
                folder: {
                    select: {
                        id: true,
                        name: true,
                        parentId: true
                    }
                }
            },
            orderBy: [
                { isCompleted: 'asc' },
                { wrongAt: 'desc' }
            ]
        });

        // 폴더별 독립적인 SRS 카드 상태 정보 조회
        // 오답노트의 folderId와 정확히 일치하는 SRS 카드들만 조회
        const vocabFolderPairs = wrongAnswers
            .filter(wa => wa.vocabId != null) // vocabId가 null이 아닌 것만
            .map(wa => ({ vocabId: wa.vocabId, folderId: wa.folderId }));
        
        const srsCards = vocabFolderPairs.length > 0 ? await prisma.srscard.findMany({
            where: {
                userId,
                itemType: 'vocab',
                OR: vocabFolderPairs.map(pair => ({
                    itemId: pair.vocabId,
                    folderId: pair.folderId // 폴더별 독립성 보장
                }))
            },
            select: {
                id: true,
                itemId: true,
                folderId: true, // 폴더 ID 포함
                stage: true,
                nextReviewAt: true,
                waitingUntil: true,
                isOverdue: true,
                overdueDeadline: true,
                overdueStartAt: true,
                isFromWrongAnswer: true,
                wrongStreakCount: true,
                isMastered: true,
                masteredAt: true,
                masterCycles: true,
                correctTotal: true,
                wrongTotal: true,
                frozenUntil: true,
                srsfolderitem: {
                    select: {
                        srsfolder: {
                            select: {
                                id: true,
                                name: true,
                                parentId: true
                            }
                        }
                    }
                }
            }
        }) : [];
        
        
        // SRS 카드 맵 생성 (폴더별 독립성을 위해 vocabId + folderId 조합으로 키 생성)
        const srsCardMap = new Map();
        srsCards.forEach(card => {
            const key = card.folderId ? `${card.itemId}_${card.folderId}` : card.itemId.toString();
            srsCardMap.set(key, card);
        });
        
        console.log(`[DEBUG] Wrong answers query result: ${wrongAnswers.length} items`);
        console.log(`[DEBUG] SRS cards found: ${srsCards.length} items`);
        console.log(`[DEBUG] SRS card map keys:`, Array.from(srsCardMap.keys()));
        console.log(`[DEBUG] Wrong answer folder IDs:`, wrongAnswers.map(wa => `${wa.vocabId}_${wa.folderId}`));
        
        // 각 vocabId별로 모든 오답 기록을 그룹핑
        const wrongAnswersByVocab = new Map();
        wrongAnswers.forEach(wa => {
            if (!wrongAnswersByVocab.has(wa.vocabId)) {
                wrongAnswersByVocab.set(wa.vocabId, []);
            }
            wrongAnswersByVocab.get(wa.vocabId).push(wa);
        });

        // 단어별로 그룹화하여 최신 오답을 대표로 하고 나머지는 히스토리로 처리
        const now = new Date();
        
        // 단어별로 최신 오답 레코드만 추출 (폴더별 독립성 고려)
        const latestWrongAnswers = new Map();
        wrongAnswers.forEach(wa => {
            // vocabId가 null인 경우 (리딩 문제 등) 처리
            if (wa.vocabId == null) {
                const key = `reading_${wa.itemId || wa.id}_${wa.folderId || 'none'}`;
                if (!latestWrongAnswers.has(key) || new Date(wa.wrongAt) > new Date(latestWrongAnswers.get(key).wrongAt)) {
                    latestWrongAnswers.set(key, wa);
                }
            } else {
                const key = wa.folderId ? `${wa.vocabId}_${wa.folderId}` : wa.vocabId.toString();
                if (!latestWrongAnswers.has(key) || new Date(wa.wrongAt) > new Date(latestWrongAnswers.get(key).wrongAt)) {
                    latestWrongAnswers.set(key, wa);
                }
            }
        });
        
        const result = Array.from(latestWrongAnswers.values()).map(wa => {
            const reviewWindowStart = new Date(wa.reviewWindowStart);
            const reviewWindowEnd = new Date(wa.reviewWindowEnd);
            
            let reviewStatus = 'pending';
            let canReview = false;
            
            if (wa.isCompleted) {
                reviewStatus = 'completed';
                canReview = false;
            } else if (now >= reviewWindowStart && now <= reviewWindowEnd) {
                reviewStatus = 'available';
                canReview = true;
            } else if (now > reviewWindowEnd) {
                reviewStatus = 'overdue';
                canReview = true;
            }
            
            const timeUntilReview = reviewStatus === 'pending' ? 
                Math.max(0, Math.ceil((reviewWindowStart.getTime() - now.getTime()) / (1000 * 60 * 60))) : 0;
            
            // 해당 단어+폴더의 SRS 카드 상태 정보 추가 (폴더별 독립성)
            const srsCardKey = wa.vocabId != null 
                ? (wa.folderId ? `${wa.vocabId}_${wa.folderId}` : wa.vocabId.toString())
                : `reading_${wa.itemId || wa.id}_${wa.folderId || 'none'}`;
            const srsCard = srsCardMap.get(srsCardKey);
            
            // 해당 단어+폴더의 모든 오답 기록 가져오기 (폴더별 독립성)
            const allWrongAnswersForVocab = wrongAnswers.filter(record => {
                // vocabId가 null인 경우 (리딩 문제 등) 처리
                if (wa.vocabId == null) {
                    return record.vocabId == null && 
                           (record.itemId === wa.itemId || record.id === wa.id) &&
                           record.folderId === wa.folderId;
                } else {
                    if (wa.folderId) {
                        return record.vocabId === wa.vocabId && record.folderId === wa.folderId;
                    } else {
                        return record.vocabId === wa.vocabId;
                    }
                }
            });
            
            const wrongAnswerHistory = allWrongAnswersForVocab
                .sort((a, b) => new Date(a.wrongAt) - new Date(b.wrongAt)) // 오래된 것부터 정렬 (첫 오답이 먼저)
                .map(record => ({
                    id: record.id,
                    wrongAt: record.wrongAt,
                    attempts: record.attempts,
                    isCompleted: record.isCompleted,
                    reviewedAt: record.reviewedAt,
                    // SRS 카드에서 현재 stage 정보를 추정
                    stageAtTime: srsCard ? srsCard.stage : 0
                }));
            
            return {
                id: wa.id,
                vocabId: wa.vocabId,
                folderId: wa.folderId, // 폴더 ID 추가
                wrongAt: wa.wrongAt,
                attempts: wa.attempts,
                isCompleted: wa.isCompleted,
                reviewedAt: wa.reviewedAt,
                reviewStatus: reviewStatus,
                canReview: canReview,
                timeUntilReview: timeUntilReview,
                // 같은 단어의 모든 오답 기록
                wrongAnswerHistory: wrongAnswerHistory,
                totalWrongAttempts: allWrongAnswersForVocab.length, // 실제 오답 횟수 = 레코드 개수
                vocab: {
                    id: wa.vocab?.id || wa.vocabId,
                    lemma: wa.vocab?.lemma || 'Unknown',
                    pos: wa.vocab?.pos || 'unknown',
                    dictentry: wa.vocab?.dictentry || null
                },
                // 오답노트의 직접적인 폴더 정보
                folder: wa.folder ? {
                    id: wa.folder.id,
                    name: wa.folder.name,
                    parentId: wa.folder.parentId
                } : null,
                // SRS 카드 상태 정보 추가
                srsCard: srsCard ? {
                    id: srsCard.id,
                    stage: srsCard.stage,
                    nextReviewAt: srsCard.nextReviewAt,
                    waitingUntil: srsCard.waitingUntil,
                    isOverdue: srsCard.isOverdue,
                    overdueDeadline: srsCard.overdueDeadline,
                    overdueStartAt: srsCard.overdueStartAt,
                    isFromWrongAnswer: srsCard.isFromWrongAnswer,
                    wrongStreakCount: srsCard.wrongStreakCount,
                    isMastered: srsCard.isMastered,
                    masteredAt: srsCard.masteredAt,
                    masterCycles: srsCard.masterCycles,
                    correctTotal: srsCard.correctTotal,
                    wrongTotal: srsCard.wrongTotal,
                    frozenUntil: srsCard.frozenUntil,
                    // 폴더 정보 추가: 오답노트와 정확히 연결된 폴더만 표시 (폴더별 독립성)
                    folders: (() => {
                        const folders = [];
                        
                        // 오답노트의 직접 폴더가 있으면 추가
                        if (wa.folder) {
                            folders.push({
                                id: wa.folder.id,
                                name: wa.folder.name,
                                parentId: wa.folder.parentId,
                                parentName: null,
                                isWrongAnswerFolder: true // 이 오답과 직접 연결된 폴더임을 표시
                            });
                        } else if (srsCard && srsCard.srsfolderitem && srsCard.srsfolderitem.length > 0) {
                            // wa.folder가 없고 SRS 카드에 폴더 정보가 있는 경우 (하위 호환성)
                            // 해당 SRS 카드의 폴더만 표시 (폴더별 독립성 보장)
                            const cardFolder = srsCard.srsfolderitem.find(item => 
                                item.srsfolder.id === srsCard.folderId
                            );
                            if (cardFolder) {
                                folders.push({
                                    id: cardFolder.srsfolder.id,
                                    name: cardFolder.srsfolder.name,
                                    parentId: cardFolder.srsfolder.parentId,
                                    parentName: null,
                                    isWrongAnswerFolder: true
                                });
                            }
                        }
                        
                        return folders;
                    })()
                } : null
            };
        });
        
        console.log(`[DEBUG] Processed ${result.length} wrong answers with correct status`);
        console.log(`[DEBUG] Available: ${result.filter(r => r.canReview).length}, Pending: ${result.filter(r => r.reviewStatus === 'pending').length}`);
        
        const simpleResult = result;
        
        return ok(res, simpleResult);
    } catch (e) {
        console.error('GET /srs/wrong-answers failed:', e);
        console.error('Error details:', {
            message: e.message,
            stack: e.stack,
            userId: req.user?.id,
            includeCompleted: req.query?.includeCompleted
        });
        return fail(res, 500, 'Failed to load wrong answers');
    }
});

// GET /srs/wrong-answers/count — 현재 복습 가능한 오답노트 개수
router.get('/wrong-answers/count', async (req, res, next) => {
    try {
        const userId = req.user.id;
        const count = await getAvailableWrongAnswersCount(userId);
        
        return ok(res, { count });
    } catch (e) {
        next(e);
    }
});

// GET /srs/wrong-answers/quiz — 오답노트 퀴즈 생성
router.get('/wrong-answers/quiz', async (req, res, next) => {
    try {
        const userId = req.user.id;
        const limit = Number(req.query.limit) || 10;
        
        const quiz = await generateWrongAnswerQuiz(userId, limit);
        
        return ok(res, quiz);
    } catch (e) {
        next(e);
    }
});

// POST /srs/wrong-answers/:vocabId/complete — 오답노트 복습 완료
router.post('/wrong-answers/:vocabId/complete', async (req, res, next) => {
    try {
        const userId = req.user.id;
        const vocabId = Number(req.params.vocabId);
        
        const success = await completeWrongAnswer(userId, vocabId);
        
        if (!success) {
            return fail(res, 400, 'Cannot complete - not in review window or item not found');
        }
        
        return ok(res, { message: 'Wrong answer completed successfully' });
    } catch (e) {
        next(e);
    }
});

// POST /srs/wrong-answers/delete-multiple — 오답노트 대량 삭제
router.post('/wrong-answers/delete-multiple', auth, async (req, res, next) => {
    console.log(`🚀 [DELETE API HIT] 삭제 API 호출됨`);
    try {
        const userId = req.user.id;
        const { wrongAnswerIds } = req.body;
        
        console.log(`🗑️ [DELETE DEBUG] userId: ${userId}`);
        console.log(`🗑️ [DELETE DEBUG] req.body:`, req.body);
        console.log(`🗑️ [DELETE DEBUG] wrongAnswerIds:`, wrongAnswerIds, 'type:', typeof wrongAnswerIds);
        
        if (!Array.isArray(wrongAnswerIds) || wrongAnswerIds.length === 0) {
            console.log(`❌ [DELETE ERROR] Validation failed - not array or empty`);
            return fail(res, 400, 'wrongAnswerIds must be a non-empty array');
        }
        
        const numericIds = wrongAnswerIds
            .map(id => {
                console.log(`🔢 [DELETE DEBUG] Converting ID: ${id} (${typeof id}) -> ${Number(id)}`);
                return Number(id);
            })
            .filter(id => !isNaN(id)); // NaN 값들 제거
            
        console.log(`🔢 [DELETE DEBUG] Final numeric IDs (filtered):`, numericIds);
        
        if (numericIds.length === 0) {
            console.log(`❌ [DELETE ERROR] No valid IDs after filtering`);
            return fail(res, 400, 'No valid numeric IDs provided');
        }
        
        console.log(`🔍 [DELETE DEBUG] About to delete wronganswer records...`);
        
        // 삭제하기 전에 리딩/리스닝 문제들의 통계를 백업
        console.log(`📊 [DELETE BACKUP] Searching for reading/listening records to backup stats...`);
        const recordsToBackup = await prisma.wronganswer.findMany({
            where: {
                id: { in: numericIds },
                userId: userId,
                itemType: { in: ['reading', 'listening'] }
            }
        });
        
        console.log(`📊 [DELETE BACKUP] Found ${recordsToBackup.length} reading/listening records to backup`);
        
        // 각 리딩/리스닝 기록의 통계를 레거시 테이블에 백업
        for (const record of recordsToBackup) {
            try {
                if (record.itemType === 'reading' && record.wrongData?.questionId) {
                    console.log(`💾 [READING BACKUP] Backing up stats for ${record.wrongData.questionId}`);
                    
                    // questionId에서 숫자 추출 (A1_R_001 -> 001 -> 0)
                    const match = record.wrongData.questionId.match(/_R_(\d+)$/);
                    const level = record.wrongData.level;
                    
                    if (match && level) {
                        const questionIndex = parseInt(match[1]) - 1; // 001 -> 0
                        
                        // readingRecord 테이블에서 기존 기록 찾기
                        const existingRecord = await prisma.readingRecord.findFirst({
                            where: {
                                userId: userId,
                                questionId: String(questionIndex),
                                level: level
                            }
                        });
                        
                        // 통계 데이터를 기존 필드에 임베드하는 방식 사용
                        const statsData = {
                            correctCount: record.wrongData.correctCount || 0,
                            incorrectCount: record.wrongData.incorrectCount || 0,
                            totalAttempts: record.wrongData.totalAttempts || record.attempts || 1
                        };
                        
                        // userAnswer 필드에 통계 정보를 JSON으로 저장 (백업용)
                        const backupData = `STATS:${JSON.stringify(statsData)}`;
                        
                        if (existingRecord) {
                            // 기존 기록이 이미 통계 백업인지 확인
                            if (!existingRecord.userAnswer?.startsWith('STATS:')) {
                                await prisma.readingRecord.update({
                                    where: { id: existingRecord.id },
                                    data: {
                                        // 기존이 실제 답안 기록이면 통계 백업으로 변환
                                        userAnswer: backupData
                                    }
                                });
                                console.log(`💾 [READING BACKUP] Updated existing record with stats: ${JSON.stringify(statsData)}`);
                            }
                        } else {
                            // 새로운 통계 전용 레코드 생성
                            await prisma.readingRecord.create({
                                data: {
                                    userId: userId,
                                    questionId: String(questionIndex),
                                    level: level,
                                    isCorrect: record.wrongData.lastResult === 'correct',
                                    userAnswer: backupData, // 통계 정보 저장
                                    correctAnswer: String(record.wrongData.correctAnswer || ''),
                                    solvedAt: record.wrongAt
                                }
                            });
                            console.log(`💾 [READING BACKUP] Created new record with stats: ${JSON.stringify(statsData)}`);
                        }
                    }
                } else if (record.itemType === 'listening' && record.wrongData?.questionId) {
                    console.log(`💾 [LISTENING BACKUP] Backing up stats for ${record.wrongData.questionId}`);
                    
                    // questionId에서 숫자 추출 (A1_L_001 -> 001 -> 0)
                    const match = record.wrongData.questionId.match(/_L_(\d+)$/);
                    const level = record.wrongData.level;
                    
                    if (match && level) {
                        const questionIndex = parseInt(match[1]) - 1; // 001 -> 0
                        
                        // listeningRecord 테이블에서 기존 기록 찾기
                        const existingRecord = await prisma.listeningRecord.findFirst({
                            where: {
                                userId: userId,
                                questionId: record.wrongData.questionId, // listeningRecord는 full questionId 사용
                                level: level
                            }
                        });
                        
                        // 통계 데이터를 기존 필드에 임베드하는 방식 사용
                        const statsData = {
                            correctCount: record.wrongData.correctCount || 0,
                            incorrectCount: record.wrongData.incorrectCount || 0,
                            totalAttempts: record.wrongData.totalAttempts || record.attempts || 1
                        };
                        
                        // userAnswer 필드에 통계 정보를 JSON으로 저장 (백업용)
                        const backupData = `STATS:${JSON.stringify(statsData)}`;
                        
                        if (existingRecord) {
                            // 기존 기록이 이미 통계 백업인지 확인
                            if (!existingRecord.userAnswer?.startsWith('STATS:')) {
                                await prisma.listeningRecord.update({
                                    where: { id: existingRecord.id },
                                    data: {
                                        // 기존이 실제 답안 기록이면 통계 백업으로 변환
                                        userAnswer: backupData
                                    }
                                });
                                console.log(`💾 [LISTENING BACKUP] Updated existing record with stats: ${JSON.stringify(statsData)}`);
                            }
                        } else {
                            // 새로운 통계 전용 레코드 생성
                            await prisma.listeningRecord.create({
                                data: {
                                    userId: userId,
                                    questionId: record.wrongData.questionId, // full questionId 저장
                                    level: level,
                                    isCorrect: record.wrongData.lastResult === 'correct',
                                    userAnswer: backupData, // 통계 정보 저장
                                    correctAnswer: String(record.wrongData.correctAnswer || ''),
                                    solvedAt: record.wrongAt
                                }
                            });
                            console.log(`💾 [LISTENING BACKUP] Created new record with stats: ${JSON.stringify(statsData)}`);
                        }
                    }
                }
            } catch (backupError) {
                console.error(`❌ [DELETE BACKUP ERROR] Failed to backup stats for record ${record.id}:`, backupError.message);
            }
        }
        
        // 사용자 소유 확인 후 삭제
        const result = await prisma.wronganswer.deleteMany({
            where: {
                id: { in: numericIds },
                userId: userId
            }
        });
        
        console.log(`✅ [DELETE SUCCESS] Deleted ${result.count} items (${recordsToBackup.length} had stats backed up)`);
        
        return ok(res, { 
            message: `${result.count}개 항목이 삭제되었습니다.`,
            deletedCount: result.count
        });
    } catch (e) {
        console.error('💥 [DELETE ERROR] POST /srs/wrong-answers/delete-multiple failed:', e.message);
        console.error('💥 [DELETE ERROR] Full error:', e);
        console.error('💥 [DELETE ERROR] Stack:', e.stack);
        return fail(res, 500, 'Failed to delete wrong answers');
    }
});

// POST /srs/folders/:folderId/accelerate-cards - 특정 카드들의 대기시간을 즉시 만료시키기
router.post('/folders/:folderId/accelerate-cards', auth, async (req, res, next) => {
    try {
        const userId = req.user.id;
        const folderId = Number(req.params.folderId);
        const { cardIds } = req.body;

        if (!folderId) {
            return fail(res, 400, 'folderId is required');
        }

        if (!Array.isArray(cardIds) || cardIds.length === 0) {
            return fail(res, 400, 'cardIds array is required');
        }

        // 폴더 소유권 확인
        const folder = await prisma.srsfolder.findFirst({
            where: { 
                id: folderId, 
                userId 
            },
            select: { id: true, name: true }
        });

        if (!folder) {
            return fail(res, 404, 'Folder not found or access denied');
        }

        // 해당 폴더에 속한 카드들만 확인
        const folderItems = await prisma.srsfolderitem.findMany({
            where: {
                folderId: folderId,
                srscard: {
                    id: { in: cardIds.map(Number) }
                }
            },
            include: {
                srscard: {
                    select: {
                        id: true,
                        nextReviewAt: true,
                        waitingUntil: true,
                        isOverdue: true,
                        isMastered: true,
                        frozenUntil: true
                    }
                }
            }
        });

        if (folderItems.length === 0) {
            return fail(res, 404, 'No matching cards found in this folder');
        }

        const now = new Date();
        const cardsToUpdate = [];

        // 선택된 모든 카드를 처리하되, mastered가 아닌 stage 0 카드만 overdue로 변경
        let processedCount = 0;
        let acceleratedCount = 0;
        
        for (const item of folderItems) {
            const card = item.srscard;
            processedCount++;
            
            // stage 0 (미학습) 카드만 overdue 상태로 변경
            if (!card.isMastered && (card.stage === 0 || card.stage === null)) {
                cardsToUpdate.push(card.id);
                acceleratedCount++;
                console.log(`[ACCELERATE] Including unlearned card ${card.id} (stage: ${card.stage}) -> will be set to overdue`);
            } else {
                console.log(`[ACCELERATE] Skipping card ${card.id} (stage: ${card.stage}, mastered: ${card.isMastered}) -> not unlearned`);
            }
        }

        // 선택된 카드가 없으면 오류
        if (processedCount === 0) {
            return fail(res, 400, 'No cards found in selection');
        }

        // stage 0 (미학습) 카드들만 overdue 상태로 변경
        let actualAcceleratedCount = 0;
        if (cardsToUpdate.length > 0) {
            const updateResult = await prisma.srscard.updateMany({
                where: {
                    id: { in: cardsToUpdate }
                },
                data: {
                    nextReviewAt: null, // 타이머 없는 overdue 상태
                    waitingUntil: null,
                    isOverdue: true, // 즉시 복습 가능하도록 overdue로 설정
                    isFromWrongAnswer: false, // 자동학습으로 설정된 overdue (오답카드가 아님)
                    overdueStartAt: now,
                    overdueDeadline: new Date(now.getTime() + (24 * 60 * 60 * 1000)), // 24시간 후 데드라인
                    frozenUntil: null // 동결 상태 해제
                }
            });
            actualAcceleratedCount = updateResult.count;
            console.log(`[SRS] Accelerated ${updateResult.count} unlearned cards to immediate review in folder ${folderId}`);
        }

        const message = actualAcceleratedCount > 0 
            ? `선택한 ${processedCount}개 카드 중 ${actualAcceleratedCount}개 단어가 복습 대기 상태로 설정되었습니다.`
            : `선택한 ${processedCount}개 카드를 처리했습니다. (마스터된 단어들은 변경되지 않았습니다)`;

        return ok(res, {
            message,
            acceleratedCount: actualAcceleratedCount,
            processedCount: processedCount,
            requestedCount: cardIds.length
        });

    } catch (e) {
        console.error('POST /srs/folders/:folderId/accelerate-cards failed:', e);
        return fail(res, 500, 'Failed to accelerate cards');
    }
});

// GET /srs/study-log?date=YYYY-MM-DD — 특정 날짜의 학습 기록 조회
router.get('/study-log', async (req, res, next) => {
    try {
        const userId = req.user.id;
        const dateParam = req.query.date;
        
        if (!dateParam) {
            return fail(res, 400, 'date parameter is required (YYYY-MM-DD format)');
        }
        
        // KST 기준으로 해당 날짜의 시작과 끝 계산
        const targetDate = dayjs.tz(dateParam, KST);
        const startOfDay = targetDate.startOf('day').toDate();
        const endOfDay = targetDate.endOf('day').toDate();
        
        // SRS 폴더 아이템에서 해당 날짜에 실제로 SRS 학습한 기록 조회
        // lastReviewedAt이 오늘 날짜인 아이템들만 포함 (실제 SRS 학습한 카드들)
        console.log(`[STUDY LOG] ===== STUDY LOG API CALLED =====`);
        console.log(`[STUDY LOG] Querying study log for user ${userId} on ${dateParam}`);
        console.log(`[STUDY LOG] Date range: ${startOfDay.toISOString()} to ${endOfDay.toISOString()}`);
        
        // 표시용: 모든 오늘 학습한 단어들 조회 (대기상태 포함)
        const allStudiedItems = await prisma.srsfolderitem.findMany({
            where: {
                srscard: {
                    userId: userId,
                    itemType: 'vocab'
                },
                lastReviewedAt: { 
                    gte: startOfDay, 
                    lte: endOfDay 
                }
            },
            include: {
                srscard: {
                    select: {
                        id: true,
                        itemId: true,
                        stage: true,
                        correctTotal: true,
                        wrongTotal: true,
                        waitingUntil: true,
                        frozenUntil: true,
                        isOverdue: true,
                        folderId: true,
                        isTodayStudy: true,
                        todayFirstResult: true,
                        todayStudyDate: true
                    }
                },
                srsfolder: {
                    select: {
                        id: true,
                        learningCurveType: true
                    }
                }
            },
            orderBy: {
                lastReviewedAt: 'desc'
            }
        });

        // vocab 정보를 별도로 조회
        const vocabIds = allStudiedItems.map(item => item.srscard.itemId);
        const vocabs = vocabIds.length > 0 ? await prisma.vocab.findMany({
            where: {
                id: { in: vocabIds }
            },
            select: {
                id: true,
                lemma: true,
                pos: true
            }
        }) : [];

        // vocab 정보와 매핑
        const vocabMap = new Map(vocabs.map(v => [v.id, v]));
        const allEnrichedCards = allStudiedItems.map(item => ({
            id: item.srscard.id,
            itemId: item.srscard.itemId,
            stage: item.srscard.stage,
            correctTotal: item.srscard.correctTotal,
            wrongTotal: item.srscard.wrongTotal,
            lastReviewedAt: item.lastReviewedAt,
            waitingUntil: item.srscard.waitingUntil,
            frozenUntil: item.srscard.frozenUntil,
            isOverdue: item.srscard.isOverdue,
            folderId: item.srscard.folderId,
            learningCurveType: item.srsfolder?.learningCurveType || 'long',
            isTodayStudy: item.srscard.isTodayStudy,
            todayFirstResult: item.srscard.todayFirstResult,
            todayStudyDate: item.srscard.todayStudyDate,
            vocab: vocabMap.get(item.srscard.itemId)
        }));
        
        // 현재 시간
        const now = new Date();
        
        // 표시용: 모든 학습한 카드 (대기상태 포함)
        const displayCards = allEnrichedCards;
        
        // 통계용: 오늘 첫 학습한 단어들만 (lemma 기준으로 중복 제거)
        // 동일한 lemma에 대해서는 첫 학습만 카운트 (폴더 상관없이)
        const firstStudyByLemma = new Map(); // key: lemma, value: card
        
        allEnrichedCards.forEach(card => {
            const lemma = card.vocab?.lemma;
            if (!lemma) return; // lemma가 없으면 스킵
            
            // 이미 해당 lemma가 있는지 확인
            if (firstStudyByLemma.has(lemma)) {
                // 더 이른 시간의 학습 기록이 있으면 그것을 유지
                const existingCard = firstStudyByLemma.get(lemma);
                if (new Date(card.lastReviewedAt) < new Date(existingCard.lastReviewedAt)) {
                    firstStudyByLemma.set(lemma, card);
                }
            } else {
                firstStudyByLemma.set(lemma, card);
            }
        });
        
        // 첫 학습 카드들 중에서 유효한 학습만 필터링
        const statsCards = Array.from(firstStudyByLemma.values()).filter(card => {
            // 모든 학습 곡선에서 동일한 기준 적용: todayFirstResult가 있으면 포함
            if (card.todayFirstResult !== null && card.todayFirstResult !== undefined) {
                console.log(`  [FIRST STUDY INCLUSION] ${card.vocab?.lemma}: todayFirstResult=${card.todayFirstResult} -> INCLUDED (first study of the day)`);
                return true;
            }
            
            // 백업: 정식 학습 상태인 카드도 포함 (isTodayStudy=false)
            if (!card.isTodayStudy) {
                console.log(`  [OFFICIAL STUDY INCLUSION] ${card.vocab?.lemma}: isTodayStudy=false -> INCLUDED (official study state)`);
                return true;
            }
            
            console.log(`  [STUDY EXCLUSION] ${card.vocab?.lemma}: No valid first study record -> EXCLUDED`);
            return false;
        });
        
        console.log(`[STUDY LOG] Display cards (all): ${displayCards.length}`);
        console.log(`[STUDY LOG] Stats cards (first studies only): ${statsCards.length}`);
        
        // 학습 통계 계산
        const totalStudied = displayCards.length; // 표시용
        const uniqueWords = new Set(displayCards.map(card => card.vocab?.lemma || 'unknown')).size;
        
        console.log(`[STUDY LOG] Raw query result: ${allStudiedItems.length} items`);
        console.log(`[STUDY LOG] After enrichment: ${totalStudied} items for display`);
        console.log(`[STUDY LOG] Valid for stats: ${statsCards.length} items`);
        console.log(`[STUDY LOG] Found ${totalStudied} studied items for user ${userId} (${statsCards.length} valid for stats):`);
        displayCards.forEach(item => {
            console.log(`  - ${item.vocab?.lemma}: lastReviewedAt=${item.lastReviewedAt?.toISOString()}, learningCurveType=${item.learningCurveType}, correct=${item.correctTotal}, wrong=${item.wrongTotal}, isTodayStudy=${item.isTodayStudy}`);
        });
        
        // 통계 계산은 statsCards만 사용
        const validStudyAttempts = statsCards;
        
        console.log(`[STUDY LOG] Using ${validStudyAttempts.length} cards for statistics calculation (isTodayStudy=false only)`);
        
        // 실제 오답률 계산에 사용할 정식 학습 시도들
        const uniqueCardResults = validStudyAttempts; // 모든 정식 학습 시도를 개별적으로 계산
        
        // 모든 정식 학습 시도를 오답률 계산에 포함
        const validCardsForErrorRate = uniqueCardResults;
        
        console.log(`[ERROR RATE INCLUSION] All ${validCardsForErrorRate.length} cards included for error rate calculation`);
        
        // 새로운 오답률 계산 로직 - validCardsForErrorRate 대상으로만 계산
        console.log(`[ERROR RATE DEBUG] Processing ${validCardsForErrorRate.length} valid cards for error rate:`);
        validCardsForErrorRate.forEach((card, index) => {
            const totalAttempts = (card.correctTotal || 0) + (card.wrongTotal || 0);
            console.log(`  ${index + 1}. ${card.vocab?.lemma}: correct=${card.correctTotal}, wrong=${card.wrongTotal}, total=${totalAttempts}, curve=${card.learningCurveType}, isTodayStudy=${card.isTodayStudy}, todayFirstResult=${card.todayFirstResult}`);
        });
        
        // 오늘 학습 횟수 계산: 오늘 첫 학습한 단어의 개수 (lemma별 1회)
        const todayTotalAttempts = validCardsForErrorRate.length; // lemma별 첫 학습 카드 개수만 카운트
        console.log(`[TODAY TOTAL ATTEMPTS] ${todayTotalAttempts} first studies today (1 per unique lemma)`);
        
        // 오답률 계산: 모든 학습 곡선에서 동일한 방식 적용 (당일 첫 학습 결과만 사용)
        let totalCorrectAttempts = 0;
        let totalWrongAttempts = 0;
        
        validCardsForErrorRate.forEach(card => {
            let correct, wrong;
            
            // 모든 학습 곡선에서 동일한 로직: 당일 첫 학습 결과만 사용 (1회 고정)
            if (card.todayFirstResult === true) {
                correct = 1;
                wrong = 0;
            } else if (card.todayFirstResult === false) {
                correct = 0; 
                wrong = 1;
            } else {
                // todayFirstResult가 없는 경우 백업 로직 (정식 학습 상태면 성공으로 간주)
                if (!card.isTodayStudy) {
                    correct = 1; // 정식 학습 완료 상태면 성공으로 간주
                    wrong = 0;
                } else {
                    correct = 0;
                    wrong = 0;
                }
            }
            
            console.log(`  [ERROR RATE] ${card.vocab?.lemma}: ${correct}✓/${wrong}✗ (today first: ${card.todayFirstResult}, curve: ${card.learningCurveType})`);
            
            totalCorrectAttempts += correct;
            totalWrongAttempts += wrong;
        });
        
        const totalAttempts = totalCorrectAttempts + totalWrongAttempts;
        console.log(`[SIMPLE ERROR RATE] Total: ${totalCorrectAttempts}✓/${totalWrongAttempts}✗ = ${totalAttempts} attempts (for error rate calculation)`);
        
        const actualValidStudiedForStats = validCardsForErrorRate.length;
        const errorRate = totalAttempts > 0 ? Math.round((totalWrongAttempts / totalAttempts) * 100) : 0;
        
        console.log(`[ERROR RATE CALCULATION]:`);
        console.log(`  - Total unique cards: ${uniqueCardResults.length}`);
        console.log(`  - Cards studied today: ${actualValidStudiedForStats}`);
        console.log(`  - Total correct attempts: ${totalCorrectAttempts}`);
        console.log(`  - Total wrong attempts: ${totalWrongAttempts}`);
        console.log(`  - Total attempts: ${totalAttempts}`);
        console.log(`  - Calculated error rate: ${errorRate}%`);
        console.log(`  - Formula: ${totalWrongAttempts} / ${totalAttempts} * 100 = ${errorRate}%`);
        
        return ok(res, {
            date: dateParam,
            studies: displayCards, // 모든 학습한 단어 표시 (대기상태 포함)
            stats: {
                totalStudied: displayCards.length, // 표시용 전체 개수
                validStudiedForStats: statsCards.length, // 통계용 카드 수
                actualValidStudiedForStats, // 실제 오답률 계산에 사용된 단어 수
                uniqueWords,
                todayTotalAttempts, // 오늘 학습 횟수 (통계용만)
                totalCorrectAttempts,
                totalWrongAttempts, 
                totalAttempts,
                errorRate,
                successRate: 100 - errorRate
            }
        });
        
    } catch (e) {
        console.error('GET /srs/study-log failed:', e);
        return fail(res, 500, 'Failed to fetch study log');
    }
});

// GET /srs/study-log/today — 오늘의 학습 기록 (편의 엔드포인트)
router.get('/study-log/today', async (req, res, next) => {
    try {
        const today = dayjs().tz(KST).format('YYYY-MM-DD');
        
        // 오늘 날짜로 리다이렉트
        req.query = { ...req.query, date: today };
        req.url = `/study-log?date=${today}`;
        
        // study-log 핸들러 직접 호출
        const studyLogHandler = router.stack.find(layer => 
            layer.route && layer.route.path === '/study-log' && layer.route.methods.get
        );
        
        if (studyLogHandler && studyLogHandler.route.stack[0]) {
            return studyLogHandler.route.stack[0].handle(req, res, next);
        } else {
            return fail(res, 500, 'Study log handler not found');
        }
    } catch (e) {
        console.error('GET /srs/study-log/today failed:', e);
        return fail(res, 500, 'Failed to fetch today study log');
    }
});


module.exports = router;
