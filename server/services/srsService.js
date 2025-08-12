//server/services/srsService.js
const { prisma } = require('../lib/prismaClient');
const createError = require('http-errors');
const { computeNextReviewDate } = require('./srsSchedule');
const { startOfKstDay, addKstDays } = require('./srsJobs');
const dayjs = require('dayjs');

/**
 * 수동으로 새 학습 폴더를 생성합니다.
 */
async function createManualFolder(userId, folderName, vocabIds = []) {
    // KST 날짜를 "YYYY-MM-DD" 형식으로 생성하고, UTC 기준 자정으로 변환
    const todayKst = startOfKstDay().format('YYYY-MM-DD'); 
    const todayUtcDate = new Date(todayKst + 'T00:00:00.000Z'); // UTC 기준 자정으로 저장
    
    console.log('[CREATE FOLDER] KST date string:', todayKst);
    console.log('[CREATE FOLDER] UTC Date for storage:', todayUtcDate);
    
    const folder = await prisma.srsFolder.create({
        data: {
            userId,
            name: folderName,
            createdDate: todayUtcDate,
            nextReviewDate: todayUtcDate, // Stage 0은 즉시 복습 가능
            cycleAnchorAt: dayjs().toDate(), // 망각곡선 기준점을 생성 시각으로 설정
            kind: 'manual',
            autoCreated: false,
            alarmActive: true,
            stage: 0, // 초기 단계
        },
    });
    
    // 단어들을 폴더에 추가
    if (vocabIds.length > 0) {
        const folderItems = vocabIds.map(vocabId => ({
            folderId: folder.id,
            vocabId: vocabId,
            learned: false
        }));
        
        await prisma.srsFolderItem.createMany({
            data: folderItems
        });
    }
    
    return folder;
}

/**
 * 폴더 완료 처리 및 다음 복습 폴더 생성
 */
async function completeFolderAndScheduleNext(folderId, userId) {
    const folder = await prisma.srsFolder.findFirst({
        where: { id: folderId, userId },
        include: {
            items: true
        }
    });
    
    if (!folder) {
        throw new Error('Folder not found');
    }
    
    const totalItems = folder.items.length;
    const learnedItems = folder.items.filter(item => item.learned).length;
    
    // 모든 단어를 다 학습했는지 확인
    if (learnedItems < totalItems) {
        throw new Error('All items must be completed before finishing the folder');
    }
    
    // 현재 폴더를 완료 상태로 변경
    await prisma.srsFolder.update({
        where: { id: folderId },
        data: {
            isCompleted: true,
            completedAt: new Date(),
            completedWordsCount: learnedItems
        }
    });
    
    // 다음 복습 단계 계산
    const nextStage = folder.stage + 1;
    const { isFinalStage } = require('./srsSchedule');
    
    // 120일 사이클 완료 체크 (Stage 5 완료)
    if (isFinalStage(folder.stage)) {
        // 120일 사이클 완료 - 마스터 상태로 변경
        const completionCount = (folder.completionCount || 0) + 1;
        
        await prisma.srsFolder.update({
            where: { id: folderId },
            data: {
                isMastered: true,
                completionCount: completionCount,
                alarmActive: false, // 알림 비활성화
                // 새로운 사이클 시작을 위한 설정
                stage: 0,
                cycleAnchorAt: new Date(), // 새로운 사이클 앵커
                nextReviewDate: dayjs().add(1, 'day').startOf('day').toDate(), // 1일 후 시작
                name: `${folder.name.replace(/ - 복습 \d+단계/g, '')} - 복습 ${completionCount}회차 완료!`
            }
        });
        
        return {
            completedFolder: { 
                ...folder, 
                isMastered: true, 
                completionCount: completionCount,
                name: `${folder.name.replace(/ - 복습 \d+단계/g, '')} - 복습 ${completionCount}회차 완료!`
            },
            nextFolder: null, // 더 이상 자동 생성하지 않음
            nextReviewDate: null,
            message: `🎉 ${completionCount}회차 복습 완료! 마스터 달성!`
        };
    }
    
    // 일반적인 다음 단계 진행
    const nextReviewDate = computeNextReviewDate(folder.cycleAnchorAt, nextStage);
    
    // 다음 복습 폴더 생성
    const nextFolder = await prisma.srsFolder.create({
        data: {
            userId,
            name: `${folder.name.replace(/ - 복습 \d+단계/g, '')} - 복습 ${nextStage}단계`,
            createdDate: dayjs(nextReviewDate).startOf('day').toDate(),
            nextReviewDate: nextReviewDate,
            cycleAnchorAt: folder.cycleAnchorAt, // 기준점은 원본 폴더와 동일
            kind: 'review',
            stage: nextStage,
            autoCreated: true,
            alarmActive: true,
            completionCount: folder.completionCount || 0
        }
    });
    
    // 학습한 단어들을 다음 복습 폴더로 복사
    const nextFolderItems = folder.items
        .filter(item => item.learned)
        .map(item => ({
            folderId: nextFolder.id,
            vocabId: item.vocabId,
            learned: false // 복습에서는 다시 미학습 상태로
        }));
    
    await prisma.srsFolderItem.createMany({
        data: nextFolderItems
    });
    
    return {
        completedFolder: folder,
        nextFolder: nextFolder,
        nextReviewDate: nextReviewDate,
        message: `다음 복습 단계(${nextStage}) 생성 완료`
    };
}

async function listFoldersForDate(userId, dateKst00) {
    const today = dayjs().startOf('day');
    
    const folders = await prisma.srsFolder.findMany({
        where: { 
            userId,
            OR: [
                { nextReviewDate: { lte: dateKst00 } }, // 복습 예정일이 오늘 이전
                { kind: 'manual', isCompleted: false }, // 미완료 수동 폴더
                { createdDate: { lte: dateKst00 } } // 생성일이 오늘 이전
            ]
        },
        orderBy: [
            { nextReviewDate: 'asc' },
            { createdDate: 'desc' }, 
            { id: 'desc' }
        ],
        include: {
            _count: { select: { items: true } },
            items: { select: { learned: true } },
        },
    });
    
    return folders.map(f => {
        const learned = f.items.filter(i => i.learned).length;
        const remaining = f._count.items - learned;
        const isDue = f.nextReviewDate ? dayjs(f.nextReviewDate).isSameOrBefore(today) : true;
        
        return { 
            id: f.id, 
            name: f.name, 
            date: f.createdDate,
            nextReviewDate: f.nextReviewDate,
            kind: f.kind, 
            stage: f.stage,
            isCompleted: f.isCompleted,
            isMastered: f.isMastered,
            completionCount: f.completionCount,
            isDue,
            alarmActive: f.alarmActive, 
            counts: { total: f._count.items, learned, remaining } 
        };
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

async function markAnswer(userId, { folderId, cardId, correct, vocabId }) { // Add folderId and vocabId
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

    // --- 연속 학습 일수 업데이트 ---
    const { updateUserStreak } = require('./streakService');
    const streakInfo = await updateUserStreak(userId);

    // --- 오답노트 처리 ---
    if (!correct && vocabId) {
        const { addWrongAnswer } = require('./wrongAnswerService');
        await addWrongAnswer(userId, vocabId);
    }

    // --- 일일 학습 통계 업데이트 ---
    await bumpDailyStat(userId, { srsSolvedInc: 1 });

    return { 
        status: correct ? 'pass' : 'fail',
        streakInfo: streakInfo
    };
}
/**
 * 마스터된 폴더를 다시 활성화합니다 (새로운 120일 사이클 시작)
 */
async function restartMasteredFolder(folderId, userId) {
    const folder = await prisma.srsFolder.findFirst({
        where: { id: folderId, userId, isMastered: true },
        include: { items: true }
    });
    
    if (!folder) {
        throw new Error('Mastered folder not found');
    }
    
    // 폴더를 다시 활성화
    await prisma.srsFolder.update({
        where: { id: folderId },
        data: {
            alarmActive: true,
            stage: 0, // Stage 0부터 다시 시작
            cycleAnchorAt: new Date(), // 새로운 사이클 앵커
            nextReviewDate: dayjs().add(1, 'day').startOf('day').toDate(), // 내일부터
            name: folder.name.replace(/ - 복습 \d+회차 완료!/, ' - 재학습'), // 이름 변경
            isCompleted: false // 다시 미완료 상태로
        }
    });
    
    // 모든 아이템을 미학습 상태로 리셋
    await prisma.srsFolderItem.updateMany({
        where: { folderId: folderId },
        data: { learned: false }
    });
    
    return {
        message: '마스터된 폴더가 재활성화되었습니다. 새로운 120일 사이클이 시작됩니다.'
    };
}

module.exports = {
    createManualFolder,
    completeFolderAndScheduleNext,
    restartMasteredFolder,
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
