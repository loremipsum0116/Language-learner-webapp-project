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

const dayjs = require('dayjs');
const utc = require('dayjs/plugin/utc');
const tz = require('dayjs/plugin/timezone');
dayjs.extend(utc); dayjs.extend(tz);

const { prisma } = require('../lib/prismaClient');
const { ok, fail } = require('../lib/resp');
const { generateMcqQuizItems } = require('../services/quizService');
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
        
        const masteredCards = await prisma.sRSCard.findMany({
            where: {
                userId: userId,
                isMastered: true
            },
            select: {
                id: true,
                itemType: true,
                itemId: true,
                masterCycles: true,
                masteredAt: true
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
        
        const masteredCards = await prisma.sRSCard.findMany({
            where: {
                userId: userId,
                isMastered: true
            },
            include: {
                folderItems: {
                    include: {
                        vocab: {
                            include: {
                                dictMeta: true
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
        const totalMastered = await prisma.sRSCard.count({
            where: {
                userId: userId,
                isMastered: true
            }
        });
        
        // 사용자 마스터 단어 대시보드 정보
        const masteryStats = await prisma.sRSCard.groupBy({
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
            const vocab = card.folderItems[0]?.vocab || null;
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
                    dictMeta: vocab.dictMeta
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
        const basicStats = await prisma.sRSCard.groupBy({
            by: ['isMastered'],
            where: { userId: userId },
            _count: { isMastered: true }
        });
        
        // 마스터 사이클별 통계
        const cycleStats = await prisma.sRSCard.groupBy({
            by: ['masterCycles'],
            where: {
                userId: userId,
                isMastered: true
            },
            _count: { masterCycles: true },
            orderBy: { masterCycles: 'asc' }
        });
        
        // 최근 마스터 완룉
        const recentMastery = await prisma.sRSCard.findMany({
            where: {
                userId: userId,
                isMastered: true
            },
            orderBy: { masteredAt: 'desc' },
            take: 5,
            include: {
                folderItems: {
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
                lemma: card.folderItems[0]?.vocab?.lemma || 'Unknown',
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
const FLAT_MODE = true;
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

// (NEW) POST /srs/folders — Create a new manual learning folder
router.post('/folders', async (req, res, next) => {
    try {
        const userId = req.user.id;
        const { name, vocabIds = [] } = req.body;
        if (!name || typeof name !== 'string' || name.trim().length === 0) {
            return fail(res, 400, 'A valid name is required.');
        }

        const folder = await createManualFolder(userId, name.trim(), vocabIds);

        return ok(res, {
            id: folder.id,
            name: folder.name,
            stage: folder.stage,
            kind: folder.kind,
            createdDate: folder.createdDate,
            alarmActive: folder.alarmActive
        });
    } catch (e) {
        if (e.code === 'P2002') return fail(res, 409, 'A folder with this name already exists.');
        next(e);
    }
});

// (MODIFIED) GET /srs/dashboard — Fetch all folders, sorted by due date
router.get('/dashboard', async (req, res, next) => {
    try {
        const userId = req.user.id;
        const folders = await prisma.srsFolder.findMany({
            where: { userId },
            select: {
                id: true, name: true,
                createdDate: true,        // ★ 추가
                nextReviewDate: true,     // ★ 추가
                stage: true, alarmActive: true,
                _count: { select: { items: true } },
            },
            orderBy: [{ nextReviewDate: 'asc' }, { id: 'asc' }],
        });

        const data = folders.map(f => ({
            id: f.id,
            name: f.name,
            createdDate: f.createdDate,      // ★ 추가
            nextReviewDate: f.nextReviewDate,
            stage: f.stage,
            alarmActive: f.alarmActive,
            total: f._count.items,
        }));
        
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

        const folder = await prisma.srsFolder.findFirst({ where: { id, userId } });
        if (!folder) return fail(res, 404, 'Folder not found.');

        const DELAYS = [3, 7, 14, 30, 60, 120]; // 상한 120일
        const nextStage = Math.min(folder.stage + 1, DELAYS.length - 1);
        const baseDate = folder.createdDate ?? startOfKstDay();
        const nextDate = dayjs(baseDate).add(DELAYS[nextStage], 'day').toDate();
        const isFinal = nextStage === (DELAYS.length - 1);
        const doneAll = nextStage === STAGE_DELAYS.length - 1;
        const updatedFolder = await prisma.srsFolder.update({
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
        await prisma.srsFolderItem.updateMany({
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

        const folder = await prisma.srsFolder.findFirst({ where: { id, userId } });
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
            await prisma.srsFolderItem.updateMany({
                where: { folderId: id },
                data: { learned: false, wrongCount: 0 },
            });
        }

        const updatedFolder = await prisma.srsFolder.update({
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

        // 사용자의 overdue 상태 및 알림 시각 확인
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { 
                hasOverdueCards: true, 
                nextOverdueAlarm: true,
                lastOverdueCheck: true 
            }
        });

        if (!user || !user.hasOverdueCards) {
            return ok(res, {
                hasOverdueCards: false,
                shouldNotifyNow: false,
                overdueCount: 0,
                tick: currentTick,
                message: '복습할 overdue 단어가 없습니다.'
            });
        }

        // overdue 카드 수 조회
        const overdueCount = await prisma.sRSCard.count({
            where: {
                userId: userId,
                isOverdue: true,
                overdueDeadline: { gt: now }
            }
        });

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

        // 사용자의 overdue 상태 확인
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { hasOverdueCards: true }
        });

        if (!user || !user.hasOverdueCards) {
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

        const exists = await prisma.srsFolder.findFirst({
            where: { userId, kind },
            select: { id: true },
        });
        
        if (exists) {
            console.log(`[QUICK-CREATE] Found existing folder: ${exists.id}`);
            return ok(res, { id: exists.id, created: false, reason: 'exists' });
        }

        console.log(`[QUICK-CREATE] Creating new folder...`);
        const now = dayjs();

        const created = await prisma.srsFolder.create({
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

        const parent = await prisma.srsFolder.findFirst({
            where: { id: parentId, userId, parentId: null },
            select: { id: true, date: true, alarmActive: true }
        });
        if (!parent) return fail(res, 404, 'parent not found');

        // 같은 부모에서 이름 중복만 금지
        const dup = await prisma.srsFolder.findFirst({
            where: { userId, parentId, name },
            select: { id: true }
        });
        if (dup) return fail(res, 409, 'duplicate name under parent');

        // ★ 유니크 키 회피: kind를 매번 유일하게
        const uniqueKind = `custom:${parentId}:${Date.now()}`;

        console.log('[SUBFOLDER.CREATE] userId=%s parentId=%s date=%s kind=%s name=%s',
            userId, parentId, parent.date?.toISOString?.(), uniqueKind, name);

        const sub = await prisma.srsFolder.create({
            data: {
                userId,
                parentId,
                name,
                date: parent.date,
                kind: uniqueKind,           // ← 중요
                scheduledOffset: null,      // ← 명시해도 됨 (nullable)
                alarmActive: parent.alarmActive,
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
        const r = await prisma.sRSCard.deleteMany({ where: { userId } });
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
        const folder = await prisma.srsFolder.findFirst({
            where: { id, userId },
            select: {
                id: true, name: true,
                createdDate: true,        // ★
                nextReviewDate: true,     // ★
                stage: true, alarmActive: true,
            },
        });
        if (!folder) return fail(res, 404, 'Folder not found');

        // 2) 폴더 아이템(카드/로컬 learned 상태 포함)
        const items = await prisma.srsFolderItem.findMany({
            where: { folderId: id },
            select: {
                id: true, cardId: true, learned: true, wrongCount: true, lastReviewedAt: true,
                vocabId: true,                               // 있으면 바로 사용
                card: { 
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
                        masteredAt: true
                    } 
                },         // 카드의 완전한 SRS 정보 포함
            },
            orderBy: { id: 'asc' },
        });

        // 3) Vocab id 수집 → 일괄 조회
        const vocabIdSet = new Set();
        for (const it of items) {
            if (it.vocabId) vocabIdSet.add(it.vocabId);
            else if (it.card?.itemId) vocabIdSet.add(it.card.itemId);
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
                        dictMeta: {
                            select: {
                                ipa: true,
                                ipaKo: true,
                                examples: true
                            }
                        }
                    }
                });
                vocabMap = new Map(vocabs.map(v => [v.id, v]));
            } catch (vocabError) {
                console.error('Vocab query failed:', vocabError);
                // fallback to basic vocab without dictMeta
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

        // 4) 화면용 큐(learned=false 기준) 구성
        const quizItems = items.map(it => {
            const vid = it.vocabId ?? it.card?.itemId ?? null;
            const v = (vid && vocabMap.get(vid)) || null;
            
            // 디버깅용 로그 (상세)
            console.log(`[DEBUG] Item ${it.id}: cardId=${it.cardId}, vocabId=${vid}, vocab found=${!!v}`);
            console.log(`[DEBUG] Card data:`, it.card);
            if (v) {
                console.log(`[DEBUG] Full vocab data:`, JSON.stringify(v, null, 2));
            }
            
            return {
                folderItemId: it.id,
                cardId: it.cardId,
                learned: it.learned,
                wrongCount: it.wrongCount,
                lastReviewedAt: it.lastReviewedAt,
                // 개별 카드의 완전한 SRS 정보 추가
                nextReviewAt: it.card?.nextReviewAt,
                stage: it.card?.stage,
                isOverdue: it.card?.isOverdue || false,
                overdueDeadline: it.card?.overdueDeadline,
                isFromWrongAnswer: it.card?.isFromWrongAnswer || false,
                waitingUntil: it.card?.waitingUntil,
                frozenUntil: it.card?.frozenUntil,        // ✅ 동결 필드 추가
                isMastered: it.card?.isMastered || false,
                masterCycles: it.card?.masterCycles || 0,
                masteredAt: it.card?.masteredAt,
                // 오답 단어 여부 판단
                isWrongAnswer: it.wrongCount > 0,
                vocab: v ? {
                    id: v.id,
                    lemma: v.lemma,
                    pos: v.pos,
                    level: v.levelCEFR,
                    dictMeta: v.dictMeta || null,
                } : null,
            };
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





// GET /srs/folders/:id/children  → 루트 + 하위 폴더 요약
router.get('/folders/:id/children', async (req, res, next) => {
    try {
        const userId = req.user.id;
        const id = Number(req.params.id);

        const root = await prisma.srsFolder.findFirst({
            where: { id, userId, parentId: null },
            select: { id: true, name: true, date: true, alarmActive: true },
        });
        if (!root) return fail(res, 404, 'root not found');

        // 1. 하위 폴더와 그 안의 아이템, 카드 정보까지 모두 조회합니다.
        const children = await prisma.srsFolder.findMany({
            where: { userId, parentId: id },

            include: {
                items: {
                    include: {
                        // ✅ card와 그 안의 vocabId(itemId)까지 포함합니다.
                        card: { select: { itemId: true } }
                    }
                }
            },
            orderBy: { id: 'asc' },
        });


        // 2. 모든 하위 폴더에서 필요한 vocabId를 중복 없이 추출합니다.
        const vocabIds = [...new Set(
            children.flatMap(c => c.items.map(i => i.card.itemId))
        )];
        // 3. 추출한 ID로 Vocab 테이블에서 단어 정보를 한 번에 조회합니다.
        const vocabs = vocabIds.length > 0
            ? await prisma.vocab.findMany({ where: { id: { in: vocabIds } } })
            : [];
        const vocabMap = new Map(vocabs.map(v => [v.id, v]));

        // 4. 최종적으로 각 하위 폴더 정보에 상세한 카드(단어) 목록을 추가합니다.
        const mapped = children.map((c) => ({
            id: c.id,
            name: c.name,
            total: c.items.length,
            completed: c.items.filter((i) => i.learned).length,
            incorrect: c.items.filter((i) => (i.wrongCount ?? 0) > 0).length,
            // ✅ 각 아이템에 `vocab` 상세 정보를 매핑하여 추가합니다.
            items: c.items.map(item => ({ ...item, vocab: vocabMap.get(item.card.itemId) || null })),
        }));

        return ok(res, { root, children: mapped });
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
        const root = await prisma.srsFolder.findFirst({
            where: { id: rootId, userId, parentId: null },
            select: { id: true, date: true, kind: true },
        });
        if (!root) return res.status(404).json({ error: '루트 폴더가 없습니다.' });

        // 2) 해당 루트 밑에서 scheduledOffset 최대값 조회
        const max = await prisma.srsFolder.aggregate({
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
        const exists = await prisma.srsFolder.findFirst({
            where: { userId, parentId: root.id, name },
            select: { id: true },
        });
        if (exists) {
            return res.status(409).json({ error: '같은 부모 아래 동일한 이름의 폴더가 이미 존재합니다.' });
        }

        // 4) 하위 폴더 생성 (루트의 date/kind 상속)
        const child = await prisma.srsFolder.create({
            data: {
                userId,
                parentId: root.id,
                name,
                date: root.date,
                kind: root.kind,
                scheduledOffset: nextOffset,
                autoCreated: false,
                alarmActive: true,
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
        const folder = await prisma.srsFolder.findFirst({
            where: { id: folderId, userId },
            select: { id: true, date: true, kind: true, parentId: true },
        });
        if (!folder) return res.status(404).json({ error: 'folder not found' });

        const result = await prisma.$transaction(async (tx) => {
            const added = [];

            console.log('[SRS ADD] Adding words (duplicates allowed):', { total: vocabIds.length });

            // 1) vocabIds → 카드가 없으면 생성 후 아이템 upsert (중복 허용)
            for (const vid of vocabIds) {
                const card = await tx.sRSCard.upsert({
                    where: {
                        userId_itemType_itemId: { userId, itemType: 'vocab', itemId: vid },
                    },
                    update: {
                        // 새로운 폴더에 추가될 때는 stage 0에서 다시 시작하고 즉시 학습 가능
                        stage: 0,
                        nextReviewAt: null,
                        waitingUntil: null,
                        isOverdue: false,
                        overdueDeadline: null,
                        isFromWrongAnswer: false
                    },
                    create: { 
                        userId, 
                        itemType: 'vocab', 
                        itemId: vid,
                        stage: 0,
                        nextReviewAt: null // 새로 추가된 단어는 즉시 학습 가능
                    },
                    select: { id: true, itemType: true, itemId: true },
                });

                await tx.srsFolderItem.upsert({
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
                const cards = await tx.sRSCard.findMany({
                    where: { id: { in: cardIds }, userId },
                    select: { id: true, itemType: true, itemId: true },
                });
                if (cards.length === 0) throw Object.assign(new Error('cards not found'), { status: 404 });

                for (const c of cards) {
                    await tx.srsFolderItem.upsert({
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
        const itemsToDelete = await prisma.srsFolderItem.findMany({
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
            // 1. 폴더와 아이템의 연결을 먼저 끊습니다. (공통)
            const result = await tx.srsFolderItem.deleteMany({
                where: { id: { in: folderItemIds } },
            });
            
            console.log('[BULK DELETE] SrsFolderItem deleteMany result:', result);

            // 2. SRSCard의 오답 횟수 초기화
            await tx.sRSCard.updateMany({
                where: {
                    id: { in: cardIdsToDelete },
                    userId: userId
                },
                data: {
                    wrongTotal: 0, // 오답 횟수 초기화
                    stage: 0,      // Stage도 초기화
                    nextReviewAt: null // 복습일 제거
                }
            });
            console.log('[BULK DELETE] Reset wrong counts for cards:', cardIdsToDelete);

            // 3. 해당 단어들의 오답노트도 삭제
            const vocabIds = await tx.sRSCard.findMany({
                where: { id: { in: cardIdsToDelete } },
                select: { itemId: true }
            });
            const vocabIdList = vocabIds.map(card => card.itemId);
            
            if (vocabIdList.length > 0) {
                // 해당 단어가 다른 폴더에도 있는지 확인
                const remainingCards = await tx.sRSCard.findMany({
                    where: {
                        userId: userId,
                        itemType: 'vocab',
                        itemId: { in: vocabIdList },
                        id: { notIn: cardIdsToDelete } // 삭제 예정이 아닌 카드들
                    },
                    select: { itemId: true }
                });
                
                const remainingVocabIds = new Set(remainingCards.map(card => card.itemId));
                const vocabsToDeleteFromWrongAnswers = vocabIdList.filter(vid => !remainingVocabIds.has(vid));
                
                if (vocabsToDeleteFromWrongAnswers.length > 0) {
                    // 다른 폴더에 없는 단어들만 오답노트에서 삭제
                    const deletedCount = await tx.wrongAnswer.deleteMany({
                        where: {
                            userId: userId,
                            vocabId: { in: vocabsToDeleteFromWrongAnswers }
                        }
                    });
                    console.log('[BULK DELETE] Deleted wrong answers for vocabs:', vocabsToDeleteFromWrongAnswers, `(${deletedCount.count} items)`);
                } else {
                    console.log('[BULK DELETE] All vocabs exist in other folders, keeping wrong answers');
                }
            }

            // 4. permanent 옵션이 true일 경우, SRSCard를 영구 삭제합니다.
            if (permanent) {
                const cardDeleteResult = await tx.sRSCard.deleteMany({
                    where: {
                        id: { in: cardIdsToDelete },
                        userId: userId, // 본인 카드만 삭제하도록 이중 확인
                    },
                });
                console.log('[BULK DELETE] SRSCard deleteMany result:', cardDeleteResult);
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

        const exists = await prisma.srsFolder.findFirst({ where: { id, userId }, select: { id: true } });
        if (!exists) return fail(res, 404, 'Folder not found');

        await prisma.$transaction(async (tx) => {
            // 폴더 아이템들 가져오기 (오답노트 정리를 위해)
            const folderItems = await tx.srsFolderItem.findMany({
                where: { folderId: id },
                select: { vocabId: true }
            });
            const vocabIds = folderItems.map(item => item.vocabId).filter(Boolean);
            
            // 폴더 아이템들과 폴더 삭제
            await tx.srsFolderItem.deleteMany({ where: { folderId: id } });
            await tx.srsFolder.delete({ where: { id } });
            
            // 삭제된 단어들이 다른 폴더에 없으면 오답노트에서도 제거
            if (vocabIds.length > 0) {
                const remainingSrsCards = await tx.sRSCard.findMany({
                    where: {
                        userId: userId,
                        itemType: 'vocab',
                        itemId: { in: vocabIds },
                        folderItems: {
                            some: {
                                folder: { userId: userId }
                            }
                        }
                    },
                    select: { itemId: true }
                });
                
                const remainingVocabIds = new Set(remainingSrsCards.map(card => card.itemId));
                const orphanedVocabIds = vocabIds.filter(vid => !remainingVocabIds.has(vid));
                
                if (orphanedVocabIds.length > 0) {
                    const deletedCount = await tx.wrongAnswer.deleteMany({
                        where: {
                            userId: userId,
                            vocabId: { in: orphanedVocabIds }
                        }
                    });
                    console.log(`[FOLDER DELETE] Cleaned up ${deletedCount.count} orphaned wrong answers for vocabs:`, orphanedVocabIds);
                }
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
                const found = await tx.srsFolder.findFirst({ where: { id, userId }, select: { id: true } });
                if (!found) continue;
                
                // 삭제할 폴더들의 모든 아이템 수집
                const children = await tx.srsFolder.findMany({ where: { parentId: id }, select: { id: true } });
                const childIds = children.map((c) => c.id);
                const allFolderIds = [id, ...childIds];
                
                const folderItems = await tx.srsFolderItem.findMany({
                    where: { folderId: { in: allFolderIds } },
                    select: { vocabId: true }
                });
                const vocabIds = folderItems.map(item => item.vocabId).filter(Boolean);
                allVocabIds.push(...vocabIds);
                
                // 폴더 삭제
                if (childIds.length) {
                    await tx.srsFolderItem.deleteMany({ where: { folderId: { in: childIds } } });
                    await tx.srsFolder.deleteMany({ where: { id: { in: childIds } } });
                }
                await tx.srsFolderItem.deleteMany({ where: { folderId: id } });
                await tx.srsFolder.delete({ where: { id } });
            }
            
            // 모든 삭제된 단어들에 대해 오답노트 정리
            if (allVocabIds.length > 0) {
                const uniqueVocabIds = [...new Set(allVocabIds)];
                const remainingSrsCards = await tx.sRSCard.findMany({
                    where: {
                        userId: userId,
                        itemType: 'vocab',
                        itemId: { in: uniqueVocabIds },
                        folderItems: {
                            some: {
                                folder: { userId: userId }
                            }
                        }
                    },
                    select: { itemId: true }
                });
                
                const remainingVocabIds = new Set(remainingSrsCards.map(card => card.itemId));
                const orphanedVocabIds = uniqueVocabIds.filter(vid => !remainingVocabIds.has(vid));
                
                if (orphanedVocabIds.length > 0) {
                    const deletedCount = await tx.wrongAnswer.deleteMany({
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
        const userSrsFolders = await prisma.srsFolder.findMany({
            where: { userId: userId },
            select: { id: true, name: true }
        });
        
        console.log(`[CLEANUP] User has ${userSrsFolders.length} SRS folders:`, userSrsFolders.map(f => f.name));
        
        if (userSrsFolders.length === 0) {
            // SRS 폴더가 없으면 모든 오답노트 삭제
            const deletedCount = await prisma.wrongAnswer.deleteMany({
                where: { userId: userId }
            });
            
            console.log(`[CLEANUP] No SRS folders found, deleted all ${deletedCount.count} wrong answers`);
            return ok(res, { 
                cleaned: deletedCount.count, 
                message: 'All wrong answers deleted (no SRS folders)' 
            });
        }
        
        // SRS 폴더가 있으면 기존 로직 사용
        const activeSrsCards = await prisma.sRSCard.findMany({
            where: {
                userId: userId,
                itemType: 'vocab',
                folderItems: {
                    some: {
                        folder: { userId: userId }
                    }
                }
            },
            select: { itemId: true }
        });
        
        const activeVocabIds = new Set(activeSrsCards.map(card => card.itemId));
        console.log(`[CLEANUP] Found ${activeVocabIds.size} active vocab IDs in SRS folders`);
        
        // 모든 오답노트 조회
        const allWrongAnswers = await prisma.wrongAnswer.findMany({
            where: { userId: userId },
            select: { id: true, vocabId: true }
        });
        
        console.log(`[CLEANUP] Found ${allWrongAnswers.length} wrong answers total`);
        
        // 활성 폴더에 없는 오답노트 찾기
        const orphanedWrongAnswers = allWrongAnswers.filter(wa => !activeVocabIds.has(wa.vocabId));
        
        if (orphanedWrongAnswers.length > 0) {
            const deletedCount = await prisma.wrongAnswer.deleteMany({
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
            const subs = await prisma.srsFolder.findMany({
                where: { userId, parentId: { not: null } },
                orderBy: [{ date: 'desc' }, { id: 'desc' }],
                select: { id: true, name: true, parentId: true, date: true }
            });
            return ok(res, subs);
        }

        // (기존 동작: 루트 등 목록)
        const data = await prisma.srsFolder.findMany({
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

        const root = await prisma.srsFolder.findFirst({
            where: { id: rootId, userId, parentId: null },
            select: { id: true, date: true, kind: true }
        });
        if (!root) return res.status(404).json({ error: '루트 폴더 없음' });

        const children = await prisma.srsFolder.findMany({
            where: { userId, parentId: root.id, date: root.date, kind: root.kind },
            select: { id: true, name: true, scheduledOffset: true, nextAlarmAt: true },
            orderBy: [{ scheduledOffset: 'asc' }, { id: 'asc' }],
        });

        const ids = children.map(c => c.id);
        const counts = ids.length
            ? await prisma.srsFolderItem.groupBy({
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

        if (folderId) {
            // 선택된 아이템이 있으면 해당 아이템만, 없으면 모든 아이템
            const whereCondition = { 
                folderId, 
                folder: { userId }
            };
            
            // 선택된 아이템이 있으면 해당 아이템만 필터링 (folderItemId 기준)
            if (selectedItems && selectedItems.length > 0) {
                whereCondition.id = { in: selectedItems };
                console.log(`[SRS QUEUE] Filtering to selected items: ${selectedItems.join(',')}`);
            }
            
            const items = await prisma.srsFolderItem.findMany({
                where: whereCondition,
                select: { 
                    id: true, 
                    cardId: true,
                    vocabId: true,
                    learned: true,
                    wrongCount: true,
                    card: { 
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
            // Generate a multiple-choice quiz from the folder's vocab IDs [211]
            const queue = await generateMcqQuizItems(prisma, userId, vocabIds);
            // Inject folderId and cardId into each quiz item for the frontend's answer submission
            const queueWithFolderId = queue.map(q => {
                const item = items.find(it => (it.vocabId ?? it.card?.itemId) === q.vocabId);
                return { 
                    ...q, 
                    folderId,
                    cardId: vocabToCardMap.get(q.vocabId) || null,
                    isLearned: item?.learned || false,
                    wrongCount: item?.wrongCount || 0,
                    stage: item?.card?.stage || 0,
                    nextReviewAt: item?.card?.nextReviewAt,
                    hasBeenAnswered: (item?.card?.correctTotal || 0) + (item?.card?.wrongTotal || 0) > 0
                };
            });
            
            return ok(res, queueWithFolderId);

        }

        // 레거시 큐 — 현재 활성 폴더에 속한 카드만
        const limit = Math.min(Number(req.query.limit || 20), 100);
        const cards = await prisma.sRSCard.findMany({
            where: { 
                userId, 
                itemType: 'vocab', 
                nextReviewAt: { lte: new Date() },
                // 현재 어떤 폴더에든 속해있는 카드만
                folderItems: {
                    some: {
                        folder: {
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
        const roots = await prisma.srsFolder.findMany({
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

        const cards = await prisma.sRSCard.findMany({
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

    const existing = await prisma.sRSCard.findMany({
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

    const r = await prisma.sRSCard.createMany({ data: toCreate });
    return ok(res, { count: r.count });
});

router.get('/all-cards', async (req, res) => {
    try {
        const cards = await prisma.sRSCard.findMany({
            where: { userId: req.user.id, itemType: 'vocab' },
            select: { id: true, itemId: true, nextReviewAt: true, stage: true },
        });
        if (!cards.length) return ok(res, []);

        const vocabIds = cards.map((c) => c.itemId);
        const vocabs = await prisma.vocab.findMany({ where: { id: { in: vocabIds } }, include: { dictMeta: true } });
        const map = new Map(vocabs.map((v) => [v.id, v]));

        const result = cards
            .map((c) => ({
                cardId: c.id,
                vocabId: c.itemId,
                lemma: map.get(c.itemId)?.lemma,
                ko_gloss: Array.isArray(map.get(c.itemId)?.dictMeta?.examples)
                    ? map.get(c.itemId).dictMeta.examples.find((ex) => ex?.kind === 'gloss')?.ko
                    : null,
                nextReviewAt: c.nextReviewAt,
                stage: c.stage,
                ipa: map.get(c.itemId)?.dictMeta?.ipa,
                ipaKo: map.get(c.itemId)?.dictMeta?.ipaKo,
            }))
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
            await tx.sRSCard.deleteMany({ where: { userId, itemType: 'vocab' } });
            if (unique.length) {
                await tx.sRSCard.createMany({
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
        
        const folder = await prisma.srsFolder.findFirst({
            where: { id: folderId, userId },
            include: { items: true }
        });
        
        if (!folder) {
            return fail(res, 404, 'Folder not found');
        }
        
        // 폴더를 학습 가능 상태로 설정하되, 복습일은 변경하지 않음
        await prisma.srsFolder.update({
            where: { id: folderId },
            data: {
                alarmActive: true, // 알림 활성화
                // stage와 nextReviewDate는 그대로 유지
            }
        });
        
        // 모든 아이템을 미학습 상태로 리셋하여 다시 학습 가능하게 함
        await prisma.srsFolderItem.updateMany({
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

// ────────────────────────────────────────────────────────────
// 오답노트 API
// ────────────────────────────────────────────────────────────

// GET /srs/wrong-answers — 오답노트 목록 조회
router.get('/wrong-answers', async (req, res, next) => {
    try {
        const userId = req.user.id;
        const includeCompleted = req.query.includeCompleted === 'true';
        
        // 실제 오답노트 데이터 조회
        const wrongAnswers = await prisma.wrongAnswer.findMany({
            where: {
                userId,
                isCompleted: includeCompleted ? undefined : false
            },
            include: {
                vocab: {
                    include: {
                        dictMeta: true
                    }
                }
            },
            orderBy: [
                { isCompleted: 'asc' },
                { wrongAt: 'desc' }
            ]
        });

        // 해당 단어들의 SRS 카드 상태 정보도 함께 조회
        const vocabIds = wrongAnswers.map(wa => wa.vocabId);
        const srsCards = vocabIds.length > 0 ? await prisma.sRSCard.findMany({
            where: {
                userId,
                itemType: 'vocab',
                itemId: { in: vocabIds }
            },
            select: {
                id: true,
                itemId: true,
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
                wrongTotal: true
            }
        }) : [];
        
        console.log(`[DEBUG] Wrong answers query result: ${wrongAnswers.length} items`);
        console.log(`[DEBUG] SRS cards found: ${srsCards.length} items`);
        
        // SRS 카드 맵 생성 (빠른 조회를 위해)
        const srsCardMap = new Map();
        srsCards.forEach(card => {
            srsCardMap.set(card.itemId, card);
        });
        
        // 올바른 복습 상태 계산
        const now = new Date();
        const result = wrongAnswers.map(wa => {
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
            
            // 해당 단어의 SRS 카드 상태 정보 추가
            const srsCard = srsCardMap.get(wa.vocabId);
            
            return {
                id: wa.id,
                vocabId: wa.vocabId,
                wrongAt: wa.wrongAt,
                attempts: wa.attempts,
                isCompleted: wa.isCompleted,
                reviewedAt: wa.reviewedAt,
                reviewStatus: reviewStatus,
                canReview: canReview,
                timeUntilReview: timeUntilReview,
                vocab: {
                    id: wa.vocab?.id || wa.vocabId,
                    lemma: wa.vocab?.lemma || 'Unknown',
                    pos: wa.vocab?.pos || 'unknown',
                    dictMeta: wa.vocab?.dictMeta || null
                },
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
                    wrongTotal: srsCard.wrongTotal
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
            userId,
            includeCompleted
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

module.exports = router;
