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
const { scheduleFolder, nextAlarmSlot } = require('../services/alarmQueue');
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
const { createManualFolder, completeFolderAndScheduleNext, restartMasteredFolder } = require('../services/srsService');
const { getUserStreakInfo } = require('../services/streakService');
const { 
    getWrongAnswers, 
    getAvailableWrongAnswersCount, 
    generateWrongAnswerQuiz,
    completeWrongAnswer 
} = require('../services/wrongAnswerService');

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
                reminderMask: 0,                                    // 다음 사이클용 초기화
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
                reminderMask: 0,
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

// server/routes/srs.js
router.get('/reminders/today', async (req, res, next) => {
    try {
        const userId = req.user.id;
        const today = startOfKstDay();                        // 당일 00:00 KST
        const nowKst = dayjs().tz('Asia/Seoul');
        const tickIndex = [0, 6, 12, 18].findIndex(h => nowKst.hour() >= h && nowKst.hour() < (h === 18 ? 24 : [0, 6, 12, 18][[0, 6, 12, 18].indexOf(h) + 1]));
        const bit = 1 << ([0, 6, 12, 18].indexOf([0, 6, 12, 18][tickIndex] ?? 0)); // 1,2,4,8

        const due = await prisma.srsFolder.findMany({
            where: { userId, alarmActive: true, nextReviewAt: today },
            select: { id: true, name: true, stage: true, reminderMask: true },
            orderBy: [{ id: 'asc' }],
        });

        const list = due.map(f => ({
            id: f.id,
            name: f.name,
            stage: f.stage,
            shouldNotifyNow: (f.reminderMask & bit) === 0,  // 아직 안 본 슬롯이면 true
            tick: [0, 6, 12, 18][tickIndex] ?? 0,
            reminderMask: f.reminderMask
        }));

        return ok(res, list);
    } catch (e) { next(e); }
});
// server/routes/srs.js
router.post('/reminders/ack', async (req, res, next) => {
    try {
        const userId = req.user.id;
        const { folderId, tick } = req.body;              // tick: 0|6|12|18
        const bit = 1 << [0, 6, 12, 18].indexOf(Number(tick));

        const f = await prisma.srsFolder.findFirst({ where: { id: Number(folderId), userId, alarmActive: true } });
        if (!f) return fail(res, 404, 'folder not found');

        const newMask = (f.reminderMask | bit) >>> 0;
        await prisma.srsFolder.update({ where: { id: f.id }, data: { reminderMask: newMask } });
        return ok(res, { folderId: f.id, reminderMask: newMask });
    } catch (e) { next(e); }
});

// POST /srs/folders/quick-create  → 오늘(KST) 루트 폴더 하나 만들기(이미 있으면 그대로 반환)
router.post('/folders/quick-create', async (req, res, next) => {
    try {
        const userId = req.user.id;
        const kind = req.body?.kind ?? 'review';
        const enableAlarm = !!req.body?.enableAlarm;

        const date = startOfKstDay(); // KST 00:00(UTC 환산)
        const exists = await prisma.srsFolder.findFirst({
            where: { userId, parentId: null, date, kind },
            select: { id: true },
        });
        if (exists) return ok(res, { id: exists.id, created: false, reason: 'exists' });

        const now = dayjs();
        const nextAlarmAt = enableAlarm ? nextAlarmSlot(dayjs()) : null;


        const created = await prisma.srsFolder.create({
            data: {
                userId,
                parentId: null,
                name: now.tz(KST).format('YYYY-MM-DD'),
                kind,
                date,
                scheduledOffset: 0,
                autoCreated: true,
                alarmActive: enableAlarm,
                nextAlarmAt,
            },
            select: { id: true },
        });

        if (enableAlarm && nextAlarmAt) {
            try { await scheduleFolder(created.id, nextAlarmAt); } catch (_) { }
        }

        return ok(res, { id: created.id, created: true });
    } catch (e) { next(e); }
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
                card: { select: { itemId: true, nextReviewAt: true, stage: true } },         // 카드의 복습 정보 포함
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
            console.log(`[DEBUG] Item ${it.id}: vocabId=${vid}, vocab found=${!!v}`);
            if (v) {
                console.log(`[DEBUG] Full vocab data:`, JSON.stringify(v, null, 2));
            }
            
            return {
                folderItemId: it.id,
                cardId: it.cardId,
                learned: it.learned,
                wrongCount: it.wrongCount,
                lastReviewedAt: it.lastReviewedAt,
                // 개별 카드의 SRS 정보 추가
                nextReviewAt: it.card?.nextReviewAt,
                stage: it.card?.stage,
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

            // 1) vocabIds → 카드가 없으면 생성 후 아이템 upsert
            for (const vid of vocabIds) {
                const card = await tx.sRSCard.upsert({
                    where: {
                        userId_itemType_itemId: { userId, itemType: 'vocab', itemId: vid },
                    },
                    update: {},
                    create: { 
                        userId, 
                        itemType: 'vocab', 
                        itemId: vid,
                        stage: 0,
                        nextReviewAt: new Date() // 즉시 복습 가능
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

            return { addedCount: added.length, items: added };
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

            // 2. permanent 옵션이 true일 경우, SRSCard를 영구 삭제합니다.
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
            await tx.srsFolderItem.deleteMany({ where: { folderId: id } });
            await tx.srsFolder.delete({ where: { id } });
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
            for (const id of ids) {
                const found = await tx.srsFolder.findFirst({ where: { id, userId }, select: { id: true } });
                if (!found) continue;
                const children = await tx.srsFolder.findMany({ where: { parentId: id }, select: { id: true } });
                const childIds = children.map((c) => c.id);
                if (childIds.length) {
                    await tx.srsFolderItem.deleteMany({ where: { folderId: { in: childIds } } });
                    await tx.srsFolder.deleteMany({ where: { id: { in: childIds } } });
                }
                await tx.srsFolderItem.deleteMany({ where: { folderId: id } });
                await tx.srsFolder.delete({ where: { id } });
            }
        });

        return ok(res, { deleted: ids.length });
    } catch (e) { next(e); }
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

// GET /srs/queue?folderId=123&limit=20
router.get('/queue', async (req, res) => {
    try {
        const userId = req.user.id;
        const folderId = req.query.folderId ? Number(req.query.folderId) : null;

        if (folderId) {
            // Only quiz unlearned items
            const items = await prisma.srsFolderItem.findMany({
                where: { folderId, folder: { userId }, learned: false },
                select: { 
                    id: true, 
                    cardId: true,
                    vocabId: true,
                    card: { select: { itemId: true } }
                },
                orderBy: { id: 'asc' },
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
            const queueWithFolderId = queue.map(q => ({ 
                ...q, 
                folderId,
                cardId: vocabToCardMap.get(q.vocabId) || null
            }));
            return ok(res, queueWithFolderId);

        }

        // 레거시 큐 — 날짜/폴더 미지정 시 기존 방식
        const limit = Math.min(Number(req.query.limit || 20), 100);
        const cards = await prisma.sRSCard.findMany({
            where: { userId, itemType: 'vocab', nextReviewAt: { lte: new Date() } },
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
        
        const wrongAnswers = await getWrongAnswers(userId, includeCompleted);
        
        return ok(res, wrongAnswers);
    } catch (e) {
        next(e);
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
