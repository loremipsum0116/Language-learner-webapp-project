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

// ────────────────────────────────────────────────────────────
// 폴더 API
// ────────────────────────────────────────────────────────────

// GET /srs/folders?date=YYYY-MM-DD  → 해당 날짜(KST)의 루트 폴더 목록
router.get('/folders', async (req, res, next) => {
  try {
    const userId = req.user.id;
    const dateKst = req.query.date ? parseKstDateYYYYMMDD(req.query.date) : startOfKstDay();

    const folders = await prisma.srsFolder.findMany({
      where: { userId, parentId: null, date: dateKst },
      orderBy: [{ date: 'desc' }, { id: 'desc' }],
      select: { id: true, name: true, date: true, alarmActive: true },
    });
    return ok(res, folders);
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
      try { await scheduleFolder(created.id, nextAlarmAt); } catch (_) {}
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
    const userId   = req.user.id;
    const parentId = Number(req.params.parentId);
    const name     = String(req.body?.name ?? '').trim();
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

    const children = await prisma.srsFolder.findMany({
      where: { userId, parentId: id },
      include: { items: { select: { learned: true, wrongCount: true } } },
      orderBy: { id: 'asc' },
    });

    const mapped = children.map((c) => ({
      id: c.id,
      name: c.name,
      total: c.items.length,
      completed: c.items.filter((i) => i.learned).length,
      incorrect: c.items.filter((i) => (i.wrongCount ?? 0) > 0).length,
    }));

    return ok(res, { root, children: mapped });
  } catch (e) { next(e); }
});

// DELETE /srs/folders/:id  (루트/하위 모두 허용)  — 하위와 아이템까지 함께 삭제
router.delete('/folders/:id', async (req, res, next) => {
  try {
    const userId = req.user.id;
    const id = Number(req.params.id);

    await prisma.$transaction(async (tx) => {
      const target = await tx.srsFolder.findFirst({ where: { id, userId }, select: { id: true } });
      if (!target) return fail(res, 404, 'folder not found');

      // 하위 폴더 삭제(아이템 포함)
      const children = await tx.srsFolder.findMany({ where: { parentId: id }, select: { id: true } });
      const childIds = children.map((c) => c.id);
      if (childIds.length) {
        await tx.srsFolderItem.deleteMany({ where: { folderId: { in: childIds } } });
        await tx.srsFolder.deleteMany({ where: { id: { in: childIds } } });
      }
      // 자기 아이템 삭제 후 자신 삭제
      await tx.srsFolderItem.deleteMany({ where: { folderId: id } });
      await tx.srsFolder.delete({ where: { id } });
    });

    return ok(res, { deleted: true });
  } catch (e) { next(e); }
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

// ────────────────────────────────────────────────────────────
// 큐 API (폴더 기반 + 레거시 겸용)
// ────────────────────────────────────────────────────────────

// GET /srs/queue?folderId=123&limit=20
router.get('/queue', async (req, res) => {
  try {
    const userId = req.user.id;
    const folderId = req.query.folderId ? Number(req.query.folderId) : null;

    if (folderId) {
      // 폴더 기반 큐
      const items = await prisma.srsFolderItem.findMany({
        where: { folderId, folder: { userId } },
        include: { card: true },
        orderBy: { id: 'asc' },
      });
      if (!items.length) return ok(res, []);

      const vocabIds = items.map((it) => it.card?.itemId).filter(Boolean);
      const vocabs = await prisma.vocab.findMany({
        where: { id: { in: vocabIds } },
        include: { dictMeta: true },
      });
      const vmap = new Map(vocabs.map((v) => [v.id, v]));

      const queue = items.map((it) => ({
        cardId: it.cardId,
        learned: it.learned,
        wrongCount: it.wrongCount,
        vocab: vmap.get(it.card?.itemId) || null,
      }));

      return ok(res, queue);
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

module.exports = router;
