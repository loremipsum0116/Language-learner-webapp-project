const { prisma } = require('../lib/prismaClient');
const createError = require('http-errors');
const { startOfKstDay, kstAddDays, kstAt } = require('../lib/kst');
const dayjs = require('dayjs');

// 간단한 간격표(예시): stage 0→1일, 1→3일, 2→7일, 3→14일, 4→30일
const OFFSETS = [1, 3, 7, 14, 30];

async function ensureTodayFolder(userId, originSessionId = null) {
    const todayKst = startOfKstDay();
    let folder = await prisma.srsFolder.findFirst({
        where: { userId, date: todayKst, kind: 'review', scheduledOffset: 0 },
    });
    if (!folder) {
        folder = await prisma.srsFolder.create({
            data: {
                userId,
                name: '오늘',
                date: todayKst,
                kind: 'review',
                scheduledOffset: 0,
                autoCreated: true,
                originSessionId: originSessionId ?? undefined,
                alarmActive: true,
            },
        });
    }
    return folder;
}

async function listFoldersForDate(userId, dateKst00) {
    // 오늘/과거 포함 목록(간단 버전)
    const folders = await prisma.srsFolder.findMany({
        where: { userId, date: { lte: dateKst00 } },
        orderBy: [{ date: 'desc' }, { id: 'desc' }],
        include: {
            _count: { select: { items: true } },
            items: { select: { learned: true } },
        },
    });
    return folders.map(f => {
        const learned = f.items.filter(i => i.learned).length;
        const remaining = f._count.items - learned;
        return { id: f.id, name: f.name, date: f.date, kind: f.kind, offset: f.scheduledOffset, alarmActive: f.alarmActive, counts: { total: f._count.items, learned, remaining } };
    });
}

async function getFolder(userId, folderId) {
    const folder = await prisma.srsFolder.findFirst({
        where: { id: folderId, userId },
        include: { items: { include: { card: true } } },
    });
    if (!folder) throw createError(404, '폴더를 찾을 수 없습니다.');
    return folder;
}

async function createCustomFolder(userId, { name, dateKst00, scheduledOffset = 0, originSessionId = null }) {
    // 요구사항: 생성 즉시 "당일 학습 폴더"로 취급, 알림 ON 고정
    const date = dateKst00 ?? startOfKstDay();
    return prisma.srsFolder.create({
        data: {
            userId,
            name: name || '오늘',
            date,
            kind: 'review',
            scheduledOffset: 0,     // 당일
            originSessionId: originSessionId ?? undefined,
            alarmActive: true,      // 종 아이콘 ON
            autoCreated: false,
        },
    });
}

// vocabIds로 들어오면 SRSCard를 보장(없으면 생성)하고 cardIds를 리턴
async function ensureCardsForVocabs(userId, vocabIds) {
    const uniq = [...new Set(vocabIds.map(Number).filter(Boolean))];
    if (!uniq.length) return [];
    const existing = await prisma.sRSCard.findMany({
        where: { userId, itemType: 'vocab', itemId: { in: uniq } },
        select: { id: true, itemId: true }
    });
    const existMap = new Map(existing.map(e => [e.itemId, e.id]));
    const toCreate = uniq
        .filter(vId => !existMap.has(vId))
        .map(vId => ({ userId, itemType: 'vocab', itemId: vId, stage: 0, nextReviewAt: new Date() }));
    if (toCreate.length) await prisma.sRSCard.createMany({ data: toCreate });
    const all = await prisma.sRSCard.findMany({
        where: { userId, itemType: 'vocab', itemId: { in: uniq } },
        select: { id: true, itemId: true }
    });
    return all.map(x => x.id); // cardIds 반환
}

async function addItemsToFolder(userId, folderId, cardIds) {
    const folder = await prisma.srsFolder.findFirst({ where: { id: folderId, userId }, select: { id: true } });
    if (!folder) throw createError(404, '폴더를 찾을 수 없습니다.');

    const existing = await prisma.srsFolderItem.findMany({
        where: { folderId, cardId: { in: cardIds } },
        select: { cardId: true },
    });

    if (existing.length > 0) {
        // 요구사항: 이미 있으면 거부
        const dups = existing.map(e => e.cardId);
        const msg = `이미 해당 폴더에 추가된 단어입니다. (cardIds: ${dups.join(',')})`;
        throw createError(409, msg);
    }

    await prisma.srsFolderItem.createMany({
        data: cardIds.map(cardId => ({ folderId, cardId })),
        skipDuplicates: true,
    });
    return { added: cardIds.length };
}

async function removeItem(userId, folderId, cardId) {
    // 권한 체크: 해당 폴더가 본인 것인지
    const folder = await prisma.srsFolder.findFirst({ where: { id: folderId, userId }, select: { id: true } });
    if (!folder) throw createError(404, '폴더를 찾을 수 없습니다.');
    await prisma.srsFolderItem.deleteMany({ where: { folderId, cardId } });
    return { ok: true };
}

async function getQueue(userId, folderId) {
    // 학습 안 한 카드만, vocab 상세 포함(단순 버전)
    const folder = await prisma.srsFolder.findFirst({
        where: { id: folderId, userId },
        select: { id: true, items: { where: { learned: false }, include: { card: true } } },
    });
    if (!folder) throw createError(404, '폴더를 찾을 수 없습니다.');

    const vocabIds = folder.items
        .filter(i => i.card.itemType === 'vocab')
        .map(i => i.card.itemId);

    const vocabMap = new Map();
    if (vocabIds.length) {
        const vocabs = await prisma.vocab.findMany({ where: { id: { in: vocabIds } } });
        for (const v of vocabs) vocabMap.set(v.id, v);
    }

    return folder.items.map(i => ({
        folderId,
        cardId: i.cardId,
        itemType: i.card.itemType,
        itemId: i.card.itemId,
        learned: i.learned,
        wrongCount: i.wrongCount,
        vocab: i.card.itemType === 'vocab' ? vocabMap.get(i.card.itemId) : null,
    }));
}

function computeNextReviewAt(card) {
    const stage = Math.max(0, Math.min(OFFSETS.length - 1, card.stage));
    const cohortDate = card.cohortDate ?? startOfKstDay();
    const days = OFFSETS[stage];
    const due = kstAddDays(cohortDate, days);
    return kstAt(due, 9, 0, 0); // KST 09:00
}

async function ensureTomorrowFolderForCard(userId, cardId) {
    const tomorrow = kstAddDays(startOfKstDay(), 1);
    let folder = await prisma.srsFolder.findFirst({
        where: { userId, date: tomorrow, kind: 'review', scheduledOffset: 1 },
    });
    if (!folder) {
        folder = await prisma.srsFolder.create({
            data: {
                userId,
                name: '내일',
                date: tomorrow,
                kind: 'review',
                scheduledOffset: 1,
                autoCreated: true,
                alarmActive: true,
            },
        });
    }
    // 폴더-아이템 존재 보장
    await prisma.srsFolderItem.upsert({
        where: { folderId_cardId: { folderId: folder.id, cardId } },
        update: {},
        create: { folderId: folder.id, cardId },
    });
}

async function bumpDailyStat(userId, { srsSolvedInc = 0, autoLearnedInc = 0, wrongDueNextInc = 0 }) {
    const today = startOfKstDay();
    await prisma.dailyStudyStat.upsert({
        where: { userId_date: { userId, date: today } },
        update: {
            srsSolved: { increment: srsSolvedInc },
            autoLearned: { increment: autoLearnedInc },
            wrongDueNext: { increment: wrongDueNextInc },
        },
        create: {
            userId,
            date: today,
            srsSolved: srsSolvedInc,
            autoLearned: autoLearnedInc,
            wrongDueNext: wrongDueNextInc,
        },
    });
}

function nextReviewAtFor(card, correct) {
    if (correct) {
        const newStage = card.stage + 1;
        // OFFSETS 배열 범위를 초과하지 않도록 조정
        const offsetDays = OFFSETS[Math.min(newStage, OFFSETS.length - 1)];
        const nextAt = dayjs().add(offsetDays, 'day').toDate();
        return { newStage, nextAt };
    } else {
        // 오답 시, stage를 0으로 리셋하고 다음 날 오전 9시에 복습하도록 설정
        const newStage = 0;
        const nextAt = dayjs().add(1, 'day').startOf('day').hour(9).toDate();
        return { newStage, nextAt };
    }
}

async function markAnswer(userId, { folderId, cardId, correct }) { // Add folderId
    const card = await prisma.sRSCard.findFirst({ where: { id: cardId, userId } });
    if (!card) throw new Error('카드를 찾을 수 없습니다.'); // [380]

    // --- SRSCard Update (Existing Logic) ---
    const { newStage, nextAt } = nextReviewAtFor(card, correct);
    if (correct) {
        await prisma.sRSCard.update({
            where: { id: cardId },
            data: {
                correctTotal: { increment: 1 }, // ✅ FIX: 스키마에 맞게 correctCount -> correctTotal 수정
                stage: newStage,
                nextReviewAt: nextAt,
            },
        });
    } else {
        await prisma.sRSCard.update({
            where: { id: cardId },
            data: {
                wrongTotal: { increment: 1 },
                stage: newStage,
                nextReviewAt: nextAt,
            },
        });
    }

    // --- SrsFolderItem Update (New Logic) ---
    if (folderId) {
        await prisma.srsFolderItem.updateMany({
            where: { folderId: folderId, cardId: cardId },
            data: {
                lastReviewedAt: new Date(),
                learned: correct, // 정답 시 learned=true, 오답 시 false
                wrongCount: { increment: correct ? 0 : 1 },
            }
        });
    }

    // --- 일일 학습 통계 업데이트 ---
    await bumpDailyStat(userId, { srsSolvedInc: 1 });

    return { status: correct ? 'pass' : 'fail' };
}
module.exports = {
    ensureTodayFolder,
    listFoldersForDate,
    getFolder,
    createCustomFolder,
    addItemsToFolder,
    removeItem,
    getQueue,
    markAnswer,
    bumpDailyStat,
    ensureCardsForVocabs,
};
