//server/services/srsService.js
const { prisma } = require('../lib/prismaClient');
const createError = require('http-errors');
const { 
  computeNextReviewDate,
  computeWaitingUntil,
  computeWrongAnswerWaitingUntil,
  computeOverdueDeadline,
  STAGE_DELAYS,
  isFinalStage
} = require('./srsSchedule');
const { startOfKstDay, addKstDays, isCardInWaitingPeriod, isCardOverdue, isCardFrozen, hasOverdueCards } = require('./srsJobs');
const dayjs = require('dayjs');

// SRS 망각곡선 일수 (Stage 0: 0일, Stage 1: 3일, Stage 2: 7일, ...)
const OFFSETS = [0, ...STAGE_DELAYS];

/**
 * 수동으로 새 학습 폴더를 생성합니다.
 */
async function createManualFolder(userId, folderName, vocabIds = [], learningCurveType = "long") {
    // KST 기준 오늘 자정을 올바르게 생성
    const todayKstDate = startOfKstDay().toDate(); // 직접 Date 객체 사용
    
    // 폴더 생성 날짜 로그 제거
    
    const folder = await prisma.srsfolder.create({
        data: {
            userId,
            name: folderName,
            createdDate: todayKstDate,
            nextReviewDate: todayKstDate, // Stage 0은 즉시 복습 가능
            cycleAnchorAt: new Date(), // 망각곡선 기준점을 생성 시각으로 설정
            kind: 'manual',
            autoCreated: false,
            alarmActive: true,
            stage: 0, // 초기 단계
            learningCurveType: learningCurveType, // 학습 곡선 타입 저장
            updatedAt: new Date(), // updatedAt 필드 추가
        },
    });
    
    // 단어들을 폴더에 추가 (폴더별 독립적인 카드 생성)
    if (vocabIds.length > 0) {
        // 새 폴더이므로 vocab 타입 검증 불필요
        const cardIds = await ensureCardsForVocabs(userId, vocabIds, folder.id);
        
        const folderItems = cardIds.map((cardId, index) => ({
            folderId: folder.id,
            cardId: cardId,
            vocabId: vocabIds[index],
            learned: false
        }));
        
        await prisma.srsfolderitem.createMany({
            data: folderItems
        });
    }
    
    return folder;
}

/**
 * 숙어/구동사용 수동 학습 폴더를 생성합니다.
 */
async function createManualIdiomFolder(userId, folderName, idiomIds = [], learningCurveType = "long") {
    // KST 기준 오늘 자정을 올바르게 생성
    const todayKstDate = startOfKstDay().toDate(); // 직접 Date 객체 사용
    
    const folder = await prisma.srsfolder.create({
        data: {
            userId,
            name: folderName,
            createdDate: todayKstDate,
            nextReviewDate: todayKstDate, // Stage 0은 즉시 복습 가능
            cycleAnchorAt: new Date(), // 망각곡선 기준점을 생성 시각으로 설정
            kind: 'manual',
            autoCreated: false,
            alarmActive: true,
            stage: 0, // 초기 단계
            learningCurveType: learningCurveType, // 학습 곡선 타입 저장
            updatedAt: new Date(), // updatedAt 필드 추가
        },
    });
    
    // 숙어들을 폴더에 추가 (폴더별 독립적인 카드 생성)
    if (idiomIds.length > 0) {
        const cardIds = await ensureCardsForIdioms(userId, idiomIds, folder.id);
        
        const folderItems = cardIds.map((cardId, index) => ({
            folderId: folder.id,
            cardId: cardId,
            vocabId: null, // 숙어는 vocabId가 없음
            learned: false
        }));
        
        await prisma.srsfolderitem.createMany({
            data: folderItems
        });
    }
    
    return folder;
}

/**
 * 폴더 완료 처리 및 다음 복습 폴더 생성
 */
async function completeFolderAndScheduleNext(folderId, userId) {
    const folder = await prisma.srsfolder.findFirst({
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
    await prisma.srsfolder.update({
        where: { id: folderId },
        data: {
            isCompleted: true,
            completedAt: new Date(),
            completedWordsCount: learnedItems
        }
    });
    
    // 다음 복습 단계 계산
    const nextStage = folder.stage + 1;
    // 마스터 완료 체크 (학습 곡선 타입에 따라 다름)
    if (isFinalStage(folder.stage, folder.learningCurveType)) {
        // 마스터 사이클 완료 - 마스터 상태로 변경
        const completionCount = (folder.completionCount || 0) + 1;
        
        await prisma.srsfolder.update({
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
    
    // 폴더 완료 처리만 수행 (다음 복습 폴더는 생성하지 않음)
    return {
        completedFolder: folder,
        nextFolder: null,
        nextReviewDate: null,
        message: `폴더 학습 완료!`
    };
}

async function listFoldersForDate(userId, dateKst00) {
    const today = dayjs().startOf('day');
    
    const folders = await prisma.srsfolder.findMany({
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
    const folder = await prisma.srsfolder.findFirst({
        where: { id: folderId, userId },
        include: { items: { include: { card: true } } },
    });
    if (!folder) throw createError(404, '폴더를 찾을 수 없습니다.');
    return folder;
}

async function createCustomFolder(userId, { name, dateKst00, scheduledOffset = 0, originSessionId = null }) {
    // 요구사항: 생성 즉시 "당일 학습 폴더"로 취급, 알림 ON 고정
    const date = dateKst00 ?? startOfKstDay();
    return prisma.srsfolder.create({
        data: {
            userId,
            name: name || '오늘',
            date,
            kind: 'review',
            scheduledOffset: 0,     // 당일
            originSessionId: originSessionId ?? undefined,
            alarmActive: true,      // 종 아이콘 ON
            autoCreated: false,
            updatedAt: new Date(),
        },
    });
}

// vocabIds로 들어오면 특정 폴더에 대한 SRSCard를 보장(없으면 생성)하고 cardIds를 리턴
async function ensureCardsForVocabs(userId, vocabIds, folderId = null) {
    const uniq = [...new Set(vocabIds.map(Number).filter(Boolean))];
    if (!uniq.length) return [];
    
    // 폴더별 독립적인 카드 조회
    const existing = await prisma.srscard.findMany({
        where: { 
            userId, 
            itemType: 'vocab', 
            itemId: { in: uniq },
            folderId: folderId  // 폴더별 독립성
        },
        select: { id: true, itemId: true }
    });
    const existMap = new Map(existing.map(e => [e.itemId, e.id]));
    const toCreate = uniq
        .filter(vId => !existMap.has(vId))
        .map(vId => ({ 
            userId, 
            itemType: 'vocab', 
            itemId: vId,
            folderId: folderId, // 폴더별 독립성
            stage: 0, 
            nextReviewAt: null,
            waitingUntil: null,
            isOverdue: false,
            frozenUntil: null,
            overdueDeadline: null,
            overdueStartAt: null
        }));
    
    if (toCreate.length) {
        // 카드 생성 로그 제거
        await prisma.srscard.createMany({ data: toCreate });
    }
    const all = await prisma.srscard.findMany({
        where: { 
            userId, 
            itemType: 'vocab', 
            itemId: { in: uniq },
            folderId: folderId  // 폴더별 독립성
        },
        select: { id: true, itemId: true }
    });
    return all.map(x => x.id); // cardIds 반환
}

// idiomIds로 들어오면 특정 폴더에 대한 SRSCard를 보장(없으면 생성)하고 cardIds를 리턴
async function ensureCardsForIdioms(userId, idiomIds, folderId = null) {
    const uniq = [...new Set(idiomIds.map(Number).filter(Boolean))];
    if (!uniq.length) return [];
    
    // 폴더별 독립적인 카드 조회
    const existing = await prisma.srscard.findMany({
        where: { 
            userId, 
            itemType: 'idiom', 
            itemId: { in: uniq },
            folderId: folderId  // 폴더별 독립성
        },
        select: { id: true, itemId: true }
    });
    const existMap = new Map(existing.map(e => [e.itemId, e.id]));
    const toCreate = uniq
        .filter(iId => !existMap.has(iId))
        .map(iId => ({ 
            userId, 
            itemType: 'idiom', 
            itemId: iId,
            folderId: folderId, // 폴더별 독립성
            stage: 0, 
            nextReviewAt: null,
            waitingUntil: null,
            isOverdue: false,
            frozenUntil: null,
            overdueDeadline: null,
            overdueStartAt: null
        }));
    
    if (toCreate.length) {
        await prisma.srscard.createMany({ data: toCreate });
    }
    const all = await prisma.srscard.findMany({
        where: { 
            userId, 
            itemType: 'idiom', 
            itemId: { in: uniq },
            folderId: folderId  // 폴더별 독립성
        },
        select: { id: true, itemId: true }
    });
    return all.map(x => x.id); // cardIds 반환
}

// 폴더의 콘텐츠 타입을 검증하는 함수 (vocab과 idiom 분리 강제)
async function validateFolderContentType(folderId, newItemType) {
    if (!folderId) return true; // 새 폴더는 검증 불필요
    
    const existingCards = await prisma.srscard.findMany({
        where: { folderId },
        select: { itemType: true },
        distinct: ['itemType']
    });
    
    const existingTypes = existingCards.map(card => card.itemType);
    
    // 빈 폴더는 어떤 타입이든 허용
    if (existingTypes.length === 0) {
        return true;
    }
    
    // 동일한 타입만 추가 가능
    if (existingTypes.includes(newItemType)) {
        return true;
    }
    
    // vocab과 idiom은 혼재 불가
    if ((existingTypes.includes('vocab') && newItemType === 'idiom') ||
        (existingTypes.includes('idiom') && newItemType === 'vocab')) {
        throw createError(400, `이 폴더에는 ${existingTypes.includes('vocab') ? '수준별/시험별 단어' : '숙어/구동사'}가 이미 포함되어 있습니다. ${newItemType === 'vocab' ? '수준별/시험별 단어' : '숙어/구동사'}는 별도의 폴더에 추가해주세요.`);
    }
    
    return true;
}

async function addItemsToFolder(userId, folderId, cardIds, itemType = 'vocab') {
    const folder = await prisma.srsfolder.findFirst({ where: { id: folderId, userId }, select: { id: true } });
    if (!folder) throw createError(404, '폴더를 찾을 수 없습니다.');
    
    // 콘텐츠 타입 검증 (vocab과 idiom 분리)
    await validateFolderContentType(folderId, itemType);

    const existing = await prisma.srsfolderitem.findMany({
        where: { folderId, cardId: { in: cardIds } },
        select: { cardId: true },
    });

    if (existing.length > 0) {
        // 요구사항: 이미 있으면 거부
        const dups = existing.map(e => e.cardId);
        const msg = `이미 해당 폴더에 추가된 단어입니다. (cardIds: ${dups.join(',')})`;
        throw createError(409, msg);
    }

    await prisma.srsfolderitem.createMany({
        data: cardIds.map(cardId => ({ folderId, cardId })),
        skipDuplicates: true,
    });
    return { added: cardIds.length };
}

async function removeItem(userId, folderId, cardId) {
    // 권한 체크: 해당 폴더가 본인 것인지
    const folder = await prisma.srsfolder.findFirst({ where: { id: folderId, userId }, select: { id: true } });
    if (!folder) throw createError(404, '폴더를 찾을 수 없습니다.');
    
    // 삭제할 아이템의 vocabId 조회 (오답노트 정리를 위해)
    const folderItem = await prisma.srsfolderitem.findFirst({
        where: { folderId, cardId },
        select: { vocabId: true }
    });
    
    // 폴더 아이템 삭제
    await prisma.srsfolderitem.deleteMany({ where: { folderId, cardId } });
    
    // 관련 오답노트 정리
    if (folderItem && folderItem.vocabId) {
        try {
            await prisma.wronganswer.deleteMany({
                where: {
                    userId,
                    folderId,
                    vocabId: folderItem.vocabId
                }
            });
            console.log(`[REMOVE ITEM] Cleaned up wrong answers for vocabId ${folderItem.vocabId} in folder ${folderId}`);
        } catch (error) {
            console.warn(`[REMOVE ITEM] Failed to clean up wrong answers:`, error);
            // 오답노트 정리 실패는 치명적이지 않음
        }
    }
    
    return { ok: true };
}

async function getQueue(userId, folderId) {
    // 학습 안 한 카드만, vocab/idiom 상세 포함
    const folder = await prisma.srsfolder.findFirst({
        where: { id: folderId, userId },
        select: { id: true, items: { where: { learned: false }, include: { card: true } } },
    });
    if (!folder) throw createError(404, '폴더를 찾을 수 없습니다.');

    // Get all vocab IDs (including both regular and migrated idioms)
    const allVocabIds = folder.items
        .filter(i => i.srscard.itemType === 'vocab' || i.srscard.itemType === 'idiom')
        .map(i => i.srscard.itemId);

    const vocabMap = new Map();
    if (allVocabIds.length) {
        const vocabs = await prisma.vocab.findMany({ 
            where: { id: { in: allVocabIds } },
            include: {
                dictentry: {
                    select: {
                        examples: true,
                        audioLocal: true
                    }
                }
            }
        });
        for (const v of vocabs) vocabMap.set(v.id, v);
    }

    return folder.items.map(i => ({
        folderId,
        cardId: i.cardId,
        itemType: i.srscard.itemType,
        itemId: i.srscard.itemId,
        learned: i.learned,
        wrongCount: i.wrongCount,
        // Always use vocab since idioms are now in vocab table
        vocab: vocabMap.get(i.srscard.itemId) || null,
        idiom: null, // Legacy field, no longer used
    }));
}

// 이 함수는 더 이상 사용하지 않음 - stage별 단순 대기시간으로 대체
// function computeNextReviewAt(card) {
//     const cohortDate = card.cohortDate ?? new Date();
//     return computeNextReviewDate(cohortDate, card.stage);
// }

async function ensureTomorrowFolderForCard(userId, cardId) {
    const tomorrow = kstAddDays(startOfKstDay(), 1);
    let folder = await prisma.srsfolder.findFirst({
        where: { userId, date: tomorrow, kind: 'review', scheduledOffset: 1 },
    });
    if (!folder) {
        folder = await prisma.srsfolder.create({
            data: {
                userId,
                name: '내일',
                date: tomorrow,
                kind: 'review',
                scheduledOffset: 1,
                autoCreated: true,
                alarmActive: true,
                updatedAt: new Date(),
            },
        });
    }
    // 폴더-아이템 존재 보장
    await prisma.srsfolderitem.upsert({
        where: { folderId_cardId: { folderId: folder.id, cardId } },
        update: {},
        create: { folderId: folder.id, cardId },
    });
}

async function bumpDailyStat(userId, { srsSolvedInc = 0, autoLearnedInc = 0, wrongDueNextInc = 0 }) {
    const today = startOfKstDay();
    await prisma.dailystudystat.upsert({
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

// 이 함수는 새 로직에서 사용하지 않으므로 제거하거나 사용하지 않음
// nextReviewAtFor 함수는 markAnswer 함수 내에서 새 로직으로 대체됨

/**
 * 새로운 SRS 시스템의 정답/오답 처리
 * 새 로직: 대기 시간 동안은 상태 변화 없음, overdue 상태에서만 학습 가능
 */
async function markAnswer(userId, { folderId, cardId, correct, vocabId }) {
    // 현재 시간 사용 (가속 시스템은 타이머 계산에만 적용)
    const now = new Date();
    
    console.log(`[MARK ANSWER START] Card ${cardId}: correct=${correct}, userId=${userId}, folderId=${folderId}`);
    console.log(`[MARK ANSWER START] Current time: ${now.toISOString()}`);
    
    // 카드 정보 조회 (새 필드들 포함) - 폴더별 독립성을 위해 folderId도 확인
    const whereCondition = { id: cardId, userId };
    if (folderId !== null && folderId !== undefined) {
        whereCondition.folderId = folderId;
    }
    
    const card = await prisma.srscard.findFirst({ 
        where: whereCondition,
        select: {
            id: true,
            stage: true,
            cohortDate: true,
            isFromWrongAnswer: true,
            wrongStreakCount: true,
            isOverdue: true,
            waitingUntil: true,
            overdueDeadline: true,
            frozenUntil: true,
            itemType: true,
            itemId: true,
            folderId: true,  // 폴더 정보도 포함
            isTodayStudy: true,
            todayFirstResult: true,
            todayStudyDate: true
        }
    });
    
    if (!card) throw new Error('카드를 찾을 수 없습니다.');
    
    // 카드 현재 상태 상세 로깅
    console.log(`[CARD STATE DEBUG] Card ${cardId} current state:`, {
        stage: card.stage,
        isOverdue: card.isOverdue,
        waitingUntil: card.waitingUntil?.toISOString(),
        nextReviewAt: card.nextReviewAt?.toISOString(),
        frozenUntil: card.frozenUntil?.toISOString(),
        overdueDeadline: card.overdueDeadline?.toISOString(),
        isFromWrongAnswer: card.isFromWrongAnswer,
        isTodayStudy: card.isTodayStudy,
        todayFirstResult: card.todayFirstResult,
        todayStudyDate: card.todayStudyDate?.toISOString()
    });
    
    // 폴더의 학습 곡선 타입 조회
    let learningCurveType = "long"; // 기본값
    if (card.folderId) {
        const folder = await prisma.srsfolder.findFirst({
            where: { id: card.folderId },
            select: { learningCurveType: true }
        });
        if (folder && folder.learningCurveType) {
            learningCurveType = folder.learningCurveType;
        }
    }
    
    // vocabId가 전달되지 않은 경우 카드에서 조회
    if (!vocabId && card.itemType === 'vocab') {
        vocabId = card.itemId;
    }

    // 오늘의 첫 학습인지 확인 (자율학습 모드에서만 적용)
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD 형식
    const cardStudyDate = card.todayStudyDate ? card.todayStudyDate.toISOString().split('T')[0] : null;
    
    let isFirstStudyToday = false;
    let shouldFixTodayResult = false;
    
    if (learningCurveType === 'free') {
        // 자율학습 모드: todayFirstResult가 null이면 첫 학습, 아니면 재학습
        if (card.todayFirstResult === null || card.todayFirstResult === undefined || cardStudyDate !== today) {
            // 오늘 첫 학습 또는 날짜가 바뀜 - 통계에 반영됨
            isFirstStudyToday = true;
            console.log(`[TODAY STUDY FREE MODE] Card ${cardId}: First study today - WILL BE COUNTED (todayFirstResult: ${card.todayFirstResult}, cardStudyDate: ${cardStudyDate}, today: ${today})`);
        } else {
            // 이미 오늘 학습한 카드 (todayFirstResult가 설정되어 있음) - 통계에 반영되지 않음
            shouldFixTodayResult = true;
            console.log(`[TODAY STUDY FREE MODE] Card ${cardId}: Already studied today - WILL NOT BE COUNTED, first result was: ${card.todayFirstResult ? 'CORRECT' : 'WRONG'}`);
        }
    } else {
        // 장기/단기 학습 모드: canUpdateCardState에 따라 결정 (후에 계산)
        console.log(`[REGULAR SRS MODE] Card ${cardId}: Regular SRS learning (curve: ${learningCurveType})`);
    }

    // 자율학습모드에서는 타이머 제약 없이 언제든 카드 상태 업데이트 허용
    let canUpdateCardState = false;
    let statusMessage = '';
    
    if (learningCurveType === 'free') {
        canUpdateCardState = true;
        statusMessage = '';
        // Free learning mode
    } else {
        // SRS 엄격한 스케줄링 규칙: 카드 상태 변경은 다음 경우에만 허용
        // 1) 처음 학습할 때 (stage 0이고 nextReviewAt이 null이거나 과거)
        // 2) overdue 상태일 때 (24시간 복습 창구 내)
        
        // 첫 학습 조건: stage 0이고 waitingUntil이 없고 nextReviewAt이 null이거나 과거인 카드
        const isFirstLearning = card.stage === 0 && 
                               !card.waitingUntil && 
                               !card.isFromWrongAnswer &&
                               (!card.nextReviewAt || new Date(card.nextReviewAt) <= now);
        
        const isInOverdueWindow = isCardOverdue(card);
        const isFrozen = isCardFrozen(card);
        
        // 오답 단어의 특별한 경우: waitingUntil이 지난 후 overdue 상태가 될 때까지의 틈새 시간
        const isWrongAnswerReady = card.isFromWrongAnswer && 
                                  card.waitingUntil && 
                                  new Date() >= new Date(card.waitingUntil) && 
                                  card.overdueDeadline && 
                                  new Date() < new Date(card.overdueDeadline);
        
        if (isFrozen) {
            // Card is frozen
            canUpdateCardState = false;
            statusMessage = '카드가 동결 상태입니다. 복습 시기가 지나 24시간 페널티가 적용되었습니다.';
        } else if (isFirstLearning) {
            // First learning allowed
            canUpdateCardState = true;
            statusMessage = '';
        } else if (isInOverdueWindow) {
            // Overdue review allowed
            canUpdateCardState = true;
            statusMessage = '';
        } else if (isWrongAnswerReady) {
            // Wrong answer card ready
            canUpdateCardState = true;
            statusMessage = '';
        } else if (isCardInWaitingPeriod(card)) {
            // Card in waiting period
            canUpdateCardState = false;
            statusMessage = '아직 대기 시간입니다. 자율 학습은 가능하지만 카드 상태는 변경되지 않습니다.';
        } else {
            // Card not in review window
            canUpdateCardState = false;
            statusMessage = '복습 시기가 아닙니다. 자율 학습은 가능하지만 카드 상태는 변경되지 않습니다.';
        }
        
        // canUpdateCardState 결정 결과 로깅
        console.log(`[CAN UPDATE STATE] Card ${cardId}: canUpdateCardState=${canUpdateCardState}`, {
            isFirstLearning,
            isInOverdueWindow,
            isFrozen,
            isWrongAnswerReady,
            isInWaitingPeriod: isCardInWaitingPeriod ? isCardInWaitingPeriod(card) : 'unknown',
            statusMessage
        });
    }
    
    // 장기/단기 모드에서 통계 반영 여부 결정
    let shouldCountInStats = false;
    if (learningCurveType !== 'free') {
        // 장기/단기 모드: 미학습 상태 OR overdue 상태에서만 통계 반영
        shouldCountInStats = canUpdateCardState; // true면 통계 반영, false면 반영 안함
        console.log(`[REGULAR SRS MODE] Card ${cardId}: shouldCountInStats=${shouldCountInStats} (canUpdateCardState=${canUpdateCardState})`);
        console.log(`[REGULAR SRS MODE] Card ${cardId}: This ${shouldCountInStats ? 'WILL' : 'WILL NOT'} be counted in error rate statistics`);
    } else {
        // 자율학습 모드: 첫 학습에서만 통계 반영
        shouldCountInStats = isFirstStudyToday; // 첫 학습이면 통계 반영, 아니면 반영 안함
        console.log(`[FREE MODE] Card ${cardId}: shouldCountInStats=${shouldCountInStats} (isFirstStudyToday=${isFirstStudyToday})`);
        console.log(`[FREE MODE] Card ${cardId}: This ${shouldCountInStats ? 'WILL' : 'WILL NOT'} be counted in error rate statistics`);
    }

    let newStage = card.stage, waitingUntil, nextReviewAt;
    let isMasteryAchieved = false; // 마스터 달성 플래그
    
    // 항상 다음 상태를 계산 (실제 업데이트와 별개)
    let calculatedStage = newStage;
    let calculatedWaitingUntil, calculatedNextReviewAt;
    
    // 다음 상태 계산
    
    if (correct) {
        // 정답 시 다음 상태 계산 (학습 곡선 타입에 따라 최대 스테이지가 다름)
        if (learningCurveType === 'free') {
            // 자율학습모드: 타이머 없이 stage만 증가
            calculatedStage = Math.min(card.stage + 1, 999); // 자율모드는 제한 없음
            calculatedWaitingUntil = null;
            calculatedNextReviewAt = null;
            // Free mode correct answer
        } else {
            const maxStage = learningCurveType === "short" ? 10 : 7;
            calculatedStage = Math.min(card.stage + 1, maxStage);
            
            // 마스터 완료 조건 확인 (학습 곡선 타입에 따라 다름)
            const isFinalStageReached = isFinalStage(card.stage, learningCurveType);
            
            if (isFinalStageReached) {
                // 마스터 완료 시
                calculatedStage = 0;
                calculatedWaitingUntil = null;
                calculatedNextReviewAt = null;
                // Mastery achieved
            } else {
                // Stage별 차별화된 대기 시간 적용
                const waitingPeriod = require('./srsSchedule').computeWaitingPeriod(calculatedStage, learningCurveType);
                // Correct answer waiting period calculation
                
                if (waitingPeriod === 0) {
                    // Stage 0: 즉시 복습 가능
                    calculatedWaitingUntil = null;
                    calculatedNextReviewAt = null;
                    // Stage 0 immediate review
                } else {
                    // Stage 1 이상: 망각곡선에 따른 대기 시간
                    calculatedWaitingUntil = computeWaitingUntil(now, calculatedStage, learningCurveType);
                    calculatedNextReviewAt = calculatedWaitingUntil; // 대기 완료 후 복습 가능
                    // Stage waiting period
                }
                // Correct answer stage transition
            }
        }
    } else {
        // 오답 시 다음 상태 계산
        if (learningCurveType === 'free') {
            // 자율학습모드: 타이머 없이 stage 처리
            if (card.stage === 0) {
                calculatedStage = 1; // stage 0에서 오답시 stage 1로
            } else {
                calculatedStage = 0; // stage 1 이상에서 오답시 stage 0으로 리셋
            }
            calculatedWaitingUntil = null;
            calculatedNextReviewAt = null;
            // Free mode wrong answer
        } else {
            if (card.stage === 0) {
                // stage 0에서 오답: 자동으로 stage 1로 올라가기
                calculatedStage = 1;
                // stage 1의 대기 시간 적용
                const waitingPeriod = require('./srsSchedule').computeWaitingPeriod(1, learningCurveType);
                if (waitingPeriod === 0) {
                    calculatedWaitingUntil = null;
                    calculatedNextReviewAt = null;
                } else {
                    calculatedWaitingUntil = computeWaitingUntil(new Date(), 1, learningCurveType);
                    calculatedNextReviewAt = calculatedWaitingUntil;
                }
                // Stage 0 wrong answer auto upgrade
            } else {
                // stage 1 이상에서 오답: 기존 로직 (stage 0으로 리셋)
                calculatedStage = 0;
                // 실제 현재 시간 기준으로 오답 대기 시간 계산 (stage에 따라 1시간 또는 24시간)
                calculatedWaitingUntil = computeWrongAnswerWaitingUntil(new Date(), card.stage);
                calculatedNextReviewAt = calculatedWaitingUntil; // 오답 단어는 대기 시간 후 복습 가능
                // Wrong answer stage reset
            }
        }
    }

    // 카드 상태 업데이트가 가능한 경우에만 실제 업데이트 실행
    if (canUpdateCardState && correct) {
        // 정답 처리
        newStage = calculatedStage;
        
        // 자율학습모드에서는 타이머 없음
        if (learningCurveType === 'free') {
            waitingUntil = null;
            nextReviewAt = null;
        } else {
            waitingUntil = calculatedWaitingUntil;
            nextReviewAt = calculatedNextReviewAt;
        }
        
        if (card.isFromWrongAnswer) {
            // 오답 단어가 정답을 맞춘 경우 → 현재 stage + 1로 업그레이드
            
            // 마스터 완료 조건 확인 (학습 곡선 타입에 따라 다름)
            const isFinalStageReached = isFinalStage(card.stage, learningCurveType);
            
            if (isFinalStageReached) {
                isMasteryAchieved = true; // 마스터 달성 플래그 설정
                
                // isTodayStudy 설정: 통계 반영 여부와 반대로 설정 (통계 반영=false, 미반영=true)
                let todayStudyUpdate = {
                    isTodayStudy: !shouldCountInStats, // 통계 반영하면 false, 안하면 true
                    todayStudyDate: now
                };
                
                // 첫 학습인 경우에만 todayFirstResult 설정
                if (shouldCountInStats) {
                    todayStudyUpdate.todayFirstResult = true; // 정답 처리
                }
                console.log(`[MASTERY CORRECT - WRONG ANSWER CARD] Card ${cardId}: Setting isTodayStudy=${!shouldCountInStats} (shouldCountInStats=${shouldCountInStats}) - ${shouldCountInStats ? 'COUNTED' : 'NOT COUNTED'} in stats`);
                
                await prisma.srscard.update({
                    where: { id: cardId },
                    data: {
                        stage: 0, // stage 0으로 리셋
                        nextReviewAt: null,
                        waitingUntil: null,
                        isOverdue: false,
                        overdueDeadline: null,
                        overdueStartAt: null,
                        isFromWrongAnswer: false,
                        wrongStreakCount: 0,
                        isMastered: true, // 마스터 완료 표시
                        masteredAt: now, // 마스터 완료 시각
                        masterCycles: { increment: 1 }, // 마스터 사이클 증가
                        ...todayStudyUpdate
                    }
                });
                
                console.log(`[SRS SERVICE] 🌟 MASTERY ACHIEVED! Wrong answer card ${cardId} completed ${learningCurveType} curve cycle`);
                newStage = 0; // 변수 업데이트
                waitingUntil = null;
                nextReviewAt = null;
                
            } else {
                // 오답 단어: 현재 stage + 1로 업그레이드하고 해당 stage의 대기시간 설정
                const maxStage = learningCurveType === "short" ? 10 : 7;
                const upgradedStage = Math.min(card.stage + 1, maxStage);
                const { computeWaitingUntil, computeWaitingPeriod } = require('./srsSchedule');
                
                let newWaitingUntil, newNextReviewAt;
                const waitingPeriod = computeWaitingPeriod(upgradedStage, learningCurveType);
                
                if (waitingPeriod === 0) {
                    // Stage 0: 즉시 복습 가능
                    newWaitingUntil = null;
                    newNextReviewAt = null;
                } else {
                    // Stage 1 이상: 망각곡선에 따른 대기 시간
                    newWaitingUntil = computeWaitingUntil(now, upgradedStage, learningCurveType);
                    newNextReviewAt = newWaitingUntil;
                }
                
                // isTodayStudy 설정: 통계 반영 여부와 반대로 설정 (통계 반영=false, 미반영=true)
                let todayStudyUpdate = {
                    isTodayStudy: !shouldCountInStats, // 통계 반영하면 false, 안하면 true
                    todayStudyDate: now
                };
                
                // 첫 학습인 경우에만 todayFirstResult 설정
                if (shouldCountInStats) {
                    todayStudyUpdate.todayFirstResult = true; // 정답 처리
                }
                console.log(`[UPGRADE CORRECT - WRONG ANSWER CARD] Card ${cardId}: Setting isTodayStudy=${!shouldCountInStats} (shouldCountInStats=${shouldCountInStats}) - ${shouldCountInStats ? 'COUNTED' : 'NOT COUNTED'} in stats`);
                
                await prisma.srscard.update({
                    where: { id: cardId },
                    data: {
                        stage: upgradedStage,
                        nextReviewAt: newNextReviewAt, // 대기 완료 후 복습 가능
                        waitingUntil: newWaitingUntil,
                        isOverdue: false,
                        overdueDeadline: null,
                        overdueStartAt: null,
                        isFromWrongAnswer: false, // 정답 처리로 일반 카드로 전환
                        wrongStreakCount: 0, // 연속 오답 리셋
                        ...todayStudyUpdate
                    }
                });
                
                console.log(`[SRS SERVICE] Wrong answer card ${cardId} upgraded: stage ${card.stage} → ${upgradedStage}, waitingUntil: ${newWaitingUntil}`);
                
                // 반환값 업데이트
                newStage = upgradedStage;
                waitingUntil = newWaitingUntil;
                nextReviewAt = newNextReviewAt;
            }
            
        } else {
            // 일반 단어가 정답을 맞춘 경우 → stage 증가 후 해당 stage의 대기시간 설정
            
            // 마스터 완료 조건 확인 (학습 곡선 타입에 따라 다름)
            const isFinalStageReached = isFinalStage(card.stage, learningCurveType);
            
            if (isFinalStageReached) {
                isMasteryAchieved = true; // 마스터 달성 플래그 설정
                
                // isTodayStudy 설정: 통계 반영 여부와 반대로 설정 (통계 반영=false, 미반영=true)
                let todayStudyUpdate = {
                    isTodayStudy: !shouldCountInStats, // 통계 반영하면 false, 안하면 true
                    todayStudyDate: now
                };
                
                // 첫 학습인 경우에만 todayFirstResult 설정
                if (shouldCountInStats) {
                    todayStudyUpdate.todayFirstResult = true; // 정답 처리
                }
                console.log(`[MASTERY CORRECT - NORMAL CARD] Card ${cardId}: Setting isTodayStudy=${!shouldCountInStats} (shouldCountInStats=${shouldCountInStats}) - ${shouldCountInStats ? 'COUNTED' : 'NOT COUNTED'} in stats`);
                
                await prisma.srscard.update({
                    where: { id: cardId },
                    data: {
                        stage: 0, // stage 0으로 리셋
                        nextReviewAt: null,
                        waitingUntil: null,
                        isOverdue: false,
                        overdueDeadline: null,
                        overdueStartAt: null,
                        isMastered: true, // 마스터 완료 표시
                        masteredAt: now, // 마스터 완료 시각
                        masterCycles: { increment: 1 }, // 마스터 사이클 증가
                        ...todayStudyUpdate
                    }
                });
                
                console.log(`[SRS SERVICE] 🌟 MASTERY ACHIEVED! Normal card ${cardId} completed ${learningCurveType} curve cycle`);
                newStage = 0; // 변수 업데이트
                waitingUntil = null;
                nextReviewAt = null;
                
            } else {
                // 일반 카드: 현재 stage + 1로 업그레이드하고 해당 stage의 대기시간 설정
                const maxStage = learningCurveType === "short" ? 10 : 7;
                const upgradedStage = Math.min(card.stage + 1, maxStage);
                const { computeWaitingUntil, computeWaitingPeriod } = require('./srsSchedule');
                
                let newWaitingUntil, newNextReviewAt;
                const waitingPeriod = computeWaitingPeriod(upgradedStage, learningCurveType);
                
                if (waitingPeriod === 0) {
                    // Stage 0: 즉시 복습 가능
                    newWaitingUntil = null;
                    newNextReviewAt = null;
                } else {
                    // Stage 1 이상: 망각곡선에 따른 대기 시간
                    newWaitingUntil = computeWaitingUntil(now, upgradedStage, learningCurveType);
                    newNextReviewAt = newWaitingUntil;
                }
                
                // isTodayStudy 설정: 통계 반영 여부와 반대로 설정 (통계 반영=false, 미반영=true)
                let todayStudyUpdate = {
                    isTodayStudy: !shouldCountInStats, // 통계 반영하면 false, 안하면 true
                    todayStudyDate: now
                };
                
                // 첫 학습인 경우에만 todayFirstResult 설정
                if (shouldCountInStats) {
                    todayStudyUpdate.todayFirstResult = true; // 정답 처리
                }
                console.log(`[UPGRADE CORRECT - NORMAL CARD] Card ${cardId}: Setting isTodayStudy=${!shouldCountInStats} (shouldCountInStats=${shouldCountInStats}) - ${shouldCountInStats ? 'COUNTED' : 'NOT COUNTED'} in stats`);
                
                await prisma.srscard.update({
                    where: { id: cardId },
                    data: {
                        stage: upgradedStage,
                        nextReviewAt: newNextReviewAt, // 대기 완료 후 복습 가능
                        waitingUntil: newWaitingUntil,
                        isOverdue: false,
                        overdueDeadline: null,
                        overdueStartAt: null,
                        ...todayStudyUpdate
                    }
                });
                
                console.log(`[SRS SERVICE] Normal card ${cardId} upgraded: stage ${card.stage} → ${upgradedStage}, waitingUntil: ${newWaitingUntil}`);
                
                // 반환값 업데이트
                newStage = upgradedStage;
                waitingUntil = newWaitingUntil;
                nextReviewAt = newNextReviewAt;
            }
        }
        
        console.log(`[SRS SERVICE] Correct answer for card ${cardId} - stage ${card.stage} → ${newStage}`);
        
    } else if (canUpdateCardState && !correct) {
        // 오답 처리
        if (learningCurveType === 'free') {
            // 자율학습모드: 타이머 없이 즉시 상태 변경
            newStage = calculatedStage;
            waitingUntil = null;
            nextReviewAt = null;
            
            // isTodayStudy 설정: 통계 반영 여부와 반대로 설정 (통계 반영=false, 미반영=true)
            let todayStudyUpdate = {
                isTodayStudy: !shouldCountInStats, // 통계 반영하면 false, 안하면 true
                todayStudyDate: now
            };
            
            // 첫 학습인 경우에만 todayFirstResult 설정
            if (shouldCountInStats) {
                todayStudyUpdate.todayFirstResult = false; // 오답 처리
            }
            
            // 업데이트 데이터 준비
            let updateData = {
                stage: newStage,
                nextReviewAt: null,
                waitingUntil: null,
                isOverdue: false,
                overdueDeadline: null,
                overdueStartAt: null,
                isFromWrongAnswer: true,
                wrongStreakCount: { increment: 1 },
                ...todayStudyUpdate
            };
            
            // wrongTotal은 마지막에 통합 처리
            
            await prisma.srscard.update({
                where: { id: cardId },
                data: updateData
            });
            
            console.log(`[SRS SERVICE] Free mode wrong answer - stage ${card.stage} → ${newStage}, no timers, wrongTotal incremented`);
        } else if (card.isOverdue) {
            // overdue에서 오답: stage 0인 경우에만 stage 1로 올라가고, 나머지는 현재 stage 유지
            const realNow = new Date();
            
            if (card.stage === 0) {
                // stage 0에서 overdue 오답: 자동으로 stage 1로 올라가기
                newStage = 1;
                // stage 1의 대기 시간 적용
                const waitingPeriod = require('./srsSchedule').computeWaitingPeriod(1, learningCurveType);
                if (waitingPeriod === 0) {
                    waitingUntil = null;
                    nextReviewAt = null;
                } else {
                    waitingUntil = computeWaitingUntil(realNow, 1, learningCurveType);
                    nextReviewAt = waitingUntil;
                }
                console.log(`[SRS SERVICE] Stage 0 overdue wrong answer - auto upgrade to stage 1, waitingUntil: ${waitingUntil?.toISOString()}`);
            } else {
                // stage 1 이상에서 overdue 오답: 현재 stage 유지하고 stage에 따른 대기 시간 후 다시 overdue 기회
                newStage = card.stage; // 현재 stage 유지 (리셋하지 않음)
                // 실제 현재 시간 기준으로 stage에 따른 오답 대기 시간 계산 (stage0: 1시간, 이외: 24시간)
                waitingUntil = computeWrongAnswerWaitingUntil(realNow, card.stage);
                nextReviewAt = waitingUntil;
                console.log(`[SRS SERVICE] Stage ${card.stage} overdue wrong answer - stage preserved, waitingUntil: ${waitingUntil?.toISOString()}`);
            }
            
            // isTodayStudy 설정: 통계 반영 여부와 반대로 설정 (통계 반영=false, 미반영=true)
            let todayStudyUpdate = {
                isTodayStudy: !shouldCountInStats, // 통계 반영하면 false, 안하면 true
                todayStudyDate: now
            };
            
            // 첫 학습인 경우에만 todayFirstResult 설정
            if (shouldCountInStats) {
                todayStudyUpdate.todayFirstResult = false; // 오답 처리
            }
            console.log(`[OVERDUE WRONG] Card ${cardId}: Setting isTodayStudy=${!shouldCountInStats} (shouldCountInStats=${shouldCountInStats}) - ${shouldCountInStats ? 'COUNTED' : 'NOT COUNTED'} in stats`);
            
            await prisma.srscard.update({
                where: { id: cardId },
                data: {
                    stage: newStage, // stage 0에서는 1로 올라가고, 나머지는 현재 stage 유지
                    nextReviewAt: waitingUntil,
                    waitingUntil: waitingUntil,
                    isOverdue: false, // 대기상태로 전환 - 대기 시간 후 크론잡이 overdue로 변경
                    overdueDeadline: null, // 대기 중에는 overdue 데드라인 없음
                    overdueStartAt: null, // 대기 중에는 overdue 시작 시점 없음  
                    isFromWrongAnswer: true,
                    wrongStreakCount: { increment: 1 },
                    ...todayStudyUpdate
                }
            });
            
            console.log(`[SRS SERVICE] Wrong answer in overdue for card ${cardId} - stage ${card.stage} preserved, 24h wait for retry`);
            console.log(`[SRS SERVICE] Current time: ${now.toISOString()}`);
            console.log(`[SRS SERVICE] WaitingUntil set to: ${waitingUntil.toISOString()}`);
            console.log(`[SRS SERVICE] Hours diff: ${Math.round((waitingUntil.getTime() - now.getTime()) / (60 * 60 * 1000))}`);
            
        } else {
            // 일반 상태에서 오답: stage 0인 경우 stage 1로 올라가고, 나머지는 stage 0 리셋
            newStage = calculatedStage;  // 계산된 stage 사용 (stage 0 → 1, 나머지 → 0)
            if (learningCurveType === 'free') {
                waitingUntil = null;
                nextReviewAt = null;
            } else {
                waitingUntil = calculatedWaitingUntil;
                nextReviewAt = calculatedNextReviewAt;
            }
            
            // isTodayStudy 설정: 통계 반영 여부와 반대로 설정 (통계 반영=false, 미반영=true)
            let todayStudyUpdate = {
                isTodayStudy: !shouldCountInStats, // 통계 반영하면 false, 안하면 true
                todayStudyDate: now
            };
            
            // 첫 학습인 경우에만 todayFirstResult 설정
            if (shouldCountInStats) {
                todayStudyUpdate.todayFirstResult = false; // 오답 처리
            }
            console.log(`[NORMAL WRONG] Card ${cardId}: Setting isTodayStudy=${!shouldCountInStats} (shouldCountInStats=${shouldCountInStats}) - ${shouldCountInStats ? 'COUNTED' : 'NOT COUNTED'} in stats`);
            
            await prisma.srscard.update({
                where: { id: cardId },
                data: {
                    stage: newStage, // stage 0에서는 1로 올라가고, 나머지는 0으로 리셋
                    nextReviewAt: nextReviewAt,
                    waitingUntil: waitingUntil,
                    isOverdue: learningCurveType === 'free' ? false : false, // 자율모드는 overdue 없음
                    overdueDeadline: learningCurveType === 'free' ? null : null, // 자율모드는 데드라인 없음
                    overdueStartAt: learningCurveType === 'free' ? null : null, // 자율모드는 시작점 없음
                    isFromWrongAnswer: true,
                    wrongStreakCount: { increment: 1 },
                    ...todayStudyUpdate
                }
            });
            
            console.log(`[SRS SERVICE] Wrong answer for card ${cardId} - stage ${card.stage} → ${newStage}`);
        }
    } else if (!canUpdateCardState && !correct) {
        // 카드 상태 업데이트 불가능 - 대기중 상태에서의 오답 (통계 업데이트 안함)
        // 계산된 값들을 반환용으로 설정
        newStage = calculatedStage;
        waitingUntil = calculatedWaitingUntil;
        nextReviewAt = calculatedNextReviewAt;
        
        let todayStudyUpdate = {};
        
        if (learningCurveType === 'free') {
            // 자율학습 모드 처리
            if (isFirstStudyToday) {
                // 첫 학습: 통계에 반영됨
                todayStudyUpdate = {
                    isTodayStudy: false, // 통계 반영
                    todayFirstResult: false, // 첫 시도 오답
                    todayStudyDate: now
                };
                // wrongTotal 업데이트 (첫 학습이므로)
                await prisma.srscard.update({
                    where: { id: cardId },
                    data: {
                            ...todayStudyUpdate
                    }
                });
                console.log(`[FREE MODE - FIRST STUDY WRONG] Card ${cardId}: First study today - COUNTED in stats, wrongTotal incremented`);
            } else {
                // 이미 오늘 학습함: 통계에 반영되지 않음, 첫 시도 결과 고정
                todayStudyUpdate = {
                    // isTodayStudy는 변경하지 않음 (기존값 유지)
                    // todayFirstResult는 변경하지 않음 (기존 값 유지)
                    todayStudyDate: now
                };
                // wrongTotal 업데이트 안함 (이미 오늘 학습했으므로)
                await prisma.srscard.update({
                    where: { id: cardId },
                    data: todayStudyUpdate
                });
                console.log(`[FREE MODE - ALREADY STUDIED WRONG] Card ${cardId}: Already studied today - NOT COUNTED in stats, isTodayStudy unchanged, first result fixed at: ${card.todayFirstResult ? 'CORRECT' : 'WRONG'}`);
            }
        } else {
            // 장기/단기 모드: 대기중 상태에서는 통계 업데이트 안함
            todayStudyUpdate = {
                isTodayStudy: true, // 대기상태 자율복습 = 통계 미반영 (고정)
                todayStudyDate: now
            };
            // wrongTotal 업데이트 안함 - 대기중 상태에서는 통계에 반영되지 않음
            await prisma.srscard.update({
                where: { id: cardId },
                data: todayStudyUpdate
            });
            console.log(`[REGULAR SRS - WAITING WRONG] Card ${cardId}: Waiting period study - isTodayStudy=true (stats fixed, not counted)`);
        }
        
        console.log(`[SRS SERVICE] Card ${cardId} - no state change, wrong answer in waiting period (no stats update)`);
    } else if (!canUpdateCardState && correct) {
        // 카드 상태 업데이트 불가능 - 대기중 상태에서의 정답 (통계 업데이트 안함)
        // 계산된 값들을 반환용으로 설정
        newStage = calculatedStage;
        waitingUntil = calculatedWaitingUntil;
        nextReviewAt = calculatedNextReviewAt;
        
        let todayStudyUpdate = {};
        
        if (learningCurveType === 'free') {
            // 자율학습 모드 처리
            if (isFirstStudyToday) {
                // 첫 학습: 통계에 반영됨
                todayStudyUpdate = {
                    isTodayStudy: false, // 통계 반영
                    todayFirstResult: true, // 첫 시도 정답
                    todayStudyDate: now
                };
                // correctTotal 업데이트 (첫 학습이므로)
                await prisma.srscard.update({
                    where: { id: cardId },
                    data: {
                        ...todayStudyUpdate
                    }
                });
                console.log(`[FREE MODE - FIRST STUDY CORRECT] Card ${cardId}: First study today - COUNTED in stats, correctTotal incremented`);
            } else {
                // 이미 오늘 학습함: 통계에 반영되지 않음, 첫 시도 결과 고정
                todayStudyUpdate = {
                    // isTodayStudy는 변경하지 않음 (기존값 유지)
                    // todayFirstResult는 변경하지 않음 (기존 값 유지)
                    todayStudyDate: now
                };
                // correctTotal 업데이트 안함 (이미 오늘 학습했으므로)
                await prisma.srscard.update({
                    where: { id: cardId },
                    data: todayStudyUpdate
                });
                console.log(`[FREE MODE - ALREADY STUDIED CORRECT] Card ${cardId}: Already studied today - NOT COUNTED in stats, isTodayStudy unchanged, first result fixed at: ${card.todayFirstResult ? 'CORRECT' : 'WRONG'}`);
            }
        } else {
            // 장기/단기 모드: 대기중 상태에서는 통계 업데이트 안함
            todayStudyUpdate = {
                isTodayStudy: true, // 대기상태 자율복습 = 통계 미반영 (고정)
                todayStudyDate: now
            };
            // correctTotal 업데이트 안함 - 대기중 상태에서는 통계에 반영되지 않음
            await prisma.srscard.update({
                where: { id: cardId },
                data: todayStudyUpdate
            });
            console.log(`[REGULAR SRS - WAITING CORRECT] Card ${cardId}: Waiting period study - isTodayStudy=true (stats fixed, not counted)`);
        }
        
        console.log(`[SRS SERVICE] Card ${cardId} - no state change, correct answer in waiting period (no stats update)`);
    } else {
        console.log(`[SRS SERVICE] Card ${cardId} - no state change (canUpdateCardState: ${canUpdateCardState}, correct: ${correct})`);
    }
    
    // 공통 업데이트 섹션 제거 - 각 케이스별로 이미 isTodayStudy가 적절히 설정됨

    // --- SrsFolderItem Update ---
    if (folderId) {
        // 현재 폴더 아이템 상태 조회
        const currentItem = await prisma.srsfolderitem.findFirst({
            where: { folderId: folderId, cardId: cardId },
            select: { learned: true }
        });
        
        // learned 상태 결정: SRS 상태 변경이 가능할 때만 learned 상태 변경
        let newLearnedState;
        if (canUpdateCardState) {
            // SRS 상태 변경 가능 시: 정답/오답에 따라 learned 상태 변경
            newLearnedState = correct;
        } else {
            // SRS 상태 변경 불가 시: 기존 learned 상태 유지 (자율 학습은 진도에 영향 없음)
            newLearnedState = currentItem?.learned ?? false;
        }
        
        // SRS 학습 기록 업데이트를 위한 데이터 준비
        const updateData = {
            learned: newLearnedState,
            // wrongCount는 SRS 상태 변경이 가능할 때만 증가 (자율 학습에서는 증가하지 않음)
            wrongCount: { increment: (correct || !canUpdateCardState) ? 0 : 1 },
        };
        
        // lastReviewedAt은 학습 기록 추적을 위해 항상 업데이트 (실제 답변했으므로)
        updateData.lastReviewedAt = now;
        if (canUpdateCardState) {
            console.log(`[SRS SERVICE] UPDATING lastReviewedAt for card ${cardId} - canUpdateCardState=true (SRS state will change)`);
        } else {
            console.log(`[SRS SERVICE] UPDATING lastReviewedAt for card ${cardId} - canUpdateCardState=false (SRS state unchanged, but tracking study)`);
        }
        
        await prisma.srsfolderitem.updateMany({
            where: { folderId: folderId, cardId: cardId },
            data: updateData
        });
    }

    // --- 연속 학습 일수 업데이트 (통계에 반영되는 학습에서만) ---
    let streakInfo = null;
    if (shouldCountInStats) {
        const { updateUserStreak } = require('./streakService');
        streakInfo = await updateUserStreak(userId);
        console.log(`[SRS SERVICE] Updated user streak: ${JSON.stringify(streakInfo)} (shouldCountInStats=true)`);
    } else {
        console.log(`[SRS SERVICE] Skipping streak update - shouldCountInStats=false (통계 반영 안함)`);
    }

    // --- 오답노트 처리 (실제 오답일 때만 추가) ---
    // 오답노트 추가 조건: 명확히 오답이고(correct === false), vocabId가 있고, 통계에 반영되는 학습인 경우에만
    const isActualWrongAnswer = correct === false && vocabId && shouldCountInStats;
    
    if (isActualWrongAnswer) {
        console.log(`[SRS SERVICE] Adding to wrong answer note: userId=${userId}, vocabId=${vocabId}, folderId=${folderId}, correct=${correct}, shouldCountInStats=${shouldCountInStats}`);
        try {
            const { addWrongAnswer } = require('./wrongAnswerService');
            await addWrongAnswer(userId, vocabId, folderId);
            console.log(`[SRS SERVICE] Successfully added to wrong answer note with folder isolation`);
            
            // lastWrongAt 업데이트 (SRS 폴더에서만, 자율학습모드에는 해당 없음)
            if (folderId) {
                await prisma.srsfolderitem.updateMany({
                    where: { folderId: folderId, cardId: cardId },
                    data: { lastWrongAt: now }
                });
                console.log(`[SRS SERVICE] Updated lastWrongAt for SRS folder item`);
            }
        } catch (error) {
            console.error(`[SRS SERVICE] Failed to add wrong answer note:`, error);
        }
    } else if (correct === false && !vocabId) {
        console.log(`[SRS SERVICE] Wrong answer but no vocabId - skipping wrong answer note`);
    } else if (correct === false && !shouldCountInStats) {
        console.log(`[SRS SERVICE] Wrong answer but shouldCountInStats=false (통계 미반영 상태) - skipping wrong answer note and lastWrongAt update`);
    } else {
        console.log(`[SRS SERVICE] Correct answer or no wrong answer processing needed: correct=${correct}, vocabId=${vocabId}, shouldCountInStats=${shouldCountInStats}`);
    }

    // --- correctTotal/wrongTotal 업데이트 (통계에 반영되는 학습에서만) ---
    if (shouldCountInStats) {
        if (correct) {
            await prisma.srscard.update({
                where: { id: cardId },
                data: { correctTotal: { increment: 1 } }
            });
            console.log(`[SRS SERVICE] Updated correctTotal for card ${cardId} (shouldCountInStats=true)`);
        } else {
            await prisma.srscard.update({
                where: { id: cardId },
                data: { wrongTotal: { increment: 1 } }
            });
            console.log(`[SRS SERVICE] Updated wrongTotal for card ${cardId} (shouldCountInStats=true)`);
        }
    } else {
        console.log(`[SRS SERVICE] Skipping correctTotal/wrongTotal update - shouldCountInStats=false (통계 반영 안함)`);
    }

    // --- 일일 학습 통계 업데이트 (통계에 반영되는 학습에서만) ---
    if (shouldCountInStats) {
        await bumpDailyStat(userId, { srsSolvedInc: 1 });
        console.log(`[SRS SERVICE] Updated daily stat for user ${userId} (shouldCountInStats=true)`);
    } else {
        console.log(`[SRS SERVICE] Skipping daily stat update - shouldCountInStats=false (통계 반영 안함)`);
    }
    
    // --- 사용자 overdue 상태 업데이트 ---
    try {
        const userHasOverdue = await hasOverdueCards(userId);
        
        await prisma.user.update({
            where: { id: userId },
            data: {
                hasOverdueCards: userHasOverdue,
                lastOverdueCheck: now
            }
        });
        
        console.log(`[SRS SERVICE] Updated user ${userId} overdue status: ${userHasOverdue}`);
    } catch (error) {
        console.error(`[SRS SERVICE] Error updating user overdue status:`, error);
        // 에러가 나도 복습 자체는 성공으로 처리
    }

    // 최신 카드 정보 조회 (DB 업데이트 후) - 폴더별 독립성을 위해 folderId도 확인
    const updatedCard = await prisma.srscard.findFirst({ 
        where: whereCondition,  // 위에서 정의한 whereCondition 재사용
        select: {
            stage: true,
            nextReviewAt: true,
            waitingUntil: true,
            isOverdue: true,
            overdueDeadline: true,
            frozenUntil: true,
            isFromWrongAnswer: true
        }
    });

    const result = { 
        status: correct ? 'correct' : 'wrong',
        newStage: canUpdateCardState ? (updatedCard?.stage ?? newStage) : calculatedStage,
        waitingUntil: canUpdateCardState ? (updatedCard?.waitingUntil ?? waitingUntil) : calculatedWaitingUntil,
        nextReviewAt: canUpdateCardState ? (updatedCard?.nextReviewAt ?? nextReviewAt) : calculatedNextReviewAt,
        // 타이머 표시를 위한 추가 정보
        isOverdue: updatedCard?.isOverdue ?? false,
        overdueDeadline: updatedCard?.overdueDeadline,
        frozenUntil: updatedCard?.frozenUntil,
        isFromWrongAnswer: updatedCard?.isFromWrongAnswer ?? false,
        streakInfo: streakInfo,
        canUpdateCardState: canUpdateCardState,
        message: statusMessage || (isMasteryAchieved ? '🎉 120일 마스터 완료! 축하합니다!' : (correct ? '정답입니다!' : '오답입니다.')),
        // 마스터 달성 여부
        isMasteryAchieved: isMasteryAchieved,
        // UI 표시용 계산된 정보 (실제 DB 변경과 무관)
        calculatedStage: calculatedStage,
        calculatedWaitingUntil: calculatedWaitingUntil,
        calculatedNextReviewAt: calculatedNextReviewAt
    };

    console.log(`[SRS SERVICE] Final result for card ${cardId}:`);
    console.log(`  Status: ${result.status}`);
    console.log(`  CanUpdateCardState: ${result.canUpdateCardState}`);
    console.log(`  Stage: ${card.stage} → ${result.newStage}`);
    console.log(`  WaitingUntil: ${result.waitingUntil?.toISOString()}`);
    console.log(`  NextReviewAt: ${result.nextReviewAt?.toISOString()}`);
    console.log(`  Calculated Stage: ${result.calculatedStage}`);
    console.log(`  Calculated WaitingUntil: ${result.calculatedWaitingUntil?.toISOString()}`);

    // --- 폴더 마스터 완료 체크 ---
    if (folderId && canUpdateCardState && isMasteryAchieved) {
        try {
            await checkAndUpdateFolderMasteryStatus(folderId, userId);
        } catch (error) {
            console.error(`[SRS SERVICE] Error checking folder mastery status:`, error);
        }
    }

    return result;
}

/**
 * 폴더의 마스터 완료 상태를 체크하고 업데이트합니다
 */
async function checkAndUpdateFolderMasteryStatus(folderId, userId) {
    // 폴더의 모든 카드가 마스터되었는지 확인
    const folderStats = await prisma.srsfolderitem.findMany({
        where: { folderId },
        include: {
            srscard: {
                select: {
                    isMastered: true,
                    userId: true
                }
            }
        }
    });

    // 해당 유저의 카드만 필터링
    const userCards = folderStats.filter(item => item.srscard.userId === userId);
    const totalCards = userCards.length;
    const masteredCards = userCards.filter(item => item.srscard.isMastered).length;

    console.log(`[FOLDER MASTERY CHECK] Folder ${folderId}: ${masteredCards}/${totalCards} cards mastered`);

    // 모든 카드가 마스터되었다면 폴더 마스터 상태 업데이트
    if (totalCards > 0 && masteredCards === totalCards) {
        const folder = await prisma.srsfolder.findFirst({
            where: { id: folderId, userId }
        });

        if (folder && !folder.isFolderMastered) {
            await prisma.srsfolder.update({
                where: { id: folderId },
                data: {
                    isFolderMastered: true,
                    folderMasteredAt: new Date(),
                    name: folder.name.includes('🏆') ? folder.name : `🏆 ${folder.name}` // 트로피 추가
                }
            });

            console.log(`[FOLDER MASTERY] 🎉 Folder ${folderId} is now MASTERED! All ${totalCards} cards completed.`);

            // 상위 폴더가 있다면 상위 폴더도 체크
            if (folder.parentId) {
                await checkAndUpdateParentFolderMasteryStatus(folder.parentId, userId);
            }
        }
    }
}

/**
 * 상위 폴더의 마스터 완료 상태를 체크하고 업데이트합니다
 */
async function checkAndUpdateParentFolderMasteryStatus(parentFolderId, userId) {
    // 상위 폴더의 모든 하위 폴더 조회
    const childFolders = await prisma.srsfolder.findMany({
        where: { 
            parentId: parentFolderId,
            userId 
        },
        select: {
            id: true,
            isFolderMastered: true
        }
    });

    const totalChildFolders = childFolders.length;
    const masteredChildFolders = childFolders.filter(child => child.isFolderMastered).length;

    console.log(`[PARENT FOLDER MASTERY CHECK] Parent folder ${parentFolderId}: ${masteredChildFolders}/${totalChildFolders} child folders mastered`);

    // 모든 하위 폴더가 마스터되었다면 상위 폴더 마스터 상태 업데이트
    if (totalChildFolders > 0 && masteredChildFolders === totalChildFolders) {
        const parentFolder = await prisma.srsfolder.findFirst({
            where: { id: parentFolderId, userId }
        });

        if (parentFolder && !parentFolder.isFolderMastered) {
            await prisma.srsfolder.update({
                where: { id: parentFolderId },
                data: {
                    isFolderMastered: true,
                    folderMasteredAt: new Date(),
                    name: parentFolder.name.includes('🌟') ? parentFolder.name : `🌟 ${parentFolder.name}` // 별 추가
                }
            });

            console.log(`[PARENT FOLDER MASTERY] 🎉 Parent folder ${parentFolderId} is now MASTERED! All ${totalChildFolders} child folders completed.`);
        }
    }
}

/**
 * 마스터된 폴더를 다시 활성화합니다 (새로운 120일 사이클 시작)
 */
async function restartMasteredFolder(folderId, userId) {
    const folder = await prisma.srsfolder.findFirst({
        where: { id: folderId, userId, isMastered: true },
        include: { items: true }
    });
    
    if (!folder) {
        throw new Error('Mastered folder not found');
    }
    
    // 폴더를 다시 활성화
    await prisma.srsfolder.update({
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
    await prisma.srsfolderitem.updateMany({
        where: { folderId: folderId },
        data: { learned: false }
    });
    
    return {
        message: '마스터된 폴더가 재활성화되었습니다. 새로운 120일 사이클이 시작됩니다.'
    };
}

/**
 * 사용자의 현재 학습 가능한 카드들을 조회합니다.
 * 모든 overdue 상태 카드들을 반환합니다 (자동학습 카드 포함).
 */
async function getAvailableCardsForReviewFixed(userId) {
    const now = new Date();
    
    // 일단 기본 조건으로 SRS 카드들을 가져옴
    const cards = await prisma.srscard.findMany({
        where: {
            userId: userId,
            isOverdue: true,
            OR: [
                { overdueDeadline: { gt: now } }, // 데드라인이 지나지 않은 카드
                { overdueDeadline: null } // 자동학습 카드 (데드라인 없음)
            ],
            frozenUntil: null // 동결되지 않은 카드만
        },
        include: {
            srsfolderitem: {
                include: {
                    vocab: true,
                    srsfolder: {
                        select: { id: true, name: true }
                    }
                }
            }
        },
        orderBy: [
            { isFromWrongAnswer: 'desc' }, // 오답 단어 우선
            { overdueStartAt: 'asc' } // 오래된 overdue부터
        ]
    });

    // 고아 카드 필터링: srsfolderitem이 있고 해당 폴더가 존재하는 카드만 반환
    const validCards = cards.filter(card => {
        // srsfolderitem이 없으면 고아
        if (!card.srsfolderitem || card.srsfolderitem.length === 0) {
            return false;
        }
        
        // srsfolderitem은 있지만 srsfolder가 null인 경우도 고아
        const hasValidFolder = card.srsfolderitem.some(item => item.srsfolder && item.srsfolder.id);
        return hasValidFolder;
    });

    return validCards;
}

/**
 * 사용자의 대기 중인 카드 수를 조회합니다.
 */
async function getWaitingCardsCount(userId) {
    const now = new Date();
    
    const count = await prisma.srscard.count({
        where: {
            userId: userId,
            waitingUntil: { gt: now },
            isOverdue: false
        }
    });

    return count;
}

/**
 * 사용자의 SRS 상태 대시보드 정보를 가져옵니다.
 */
async function getSrsStatus(userId) {
    const now = new Date();
    
    const [overdueCount, waitingCount, frozenCount, totalCards, masteredCount] = await Promise.all([
        prisma.srscard.count({
            where: {
                userId: userId,
                isOverdue: true,
                overdueDeadline: { gt: now }
            }
        }),
        prisma.srscard.count({
            where: {
                userId: userId,
                waitingUntil: { gt: now },
                isOverdue: false,
                frozenUntil: null
            }
        }),
        prisma.srscard.count({
            where: {
                userId: userId,
                frozenUntil: { gt: now }
            }
        }),
        prisma.srscard.count({
            where: { userId: userId }
        }),
        prisma.srscard.count({
            where: {
                userId: userId,
                isMastered: true
            }
        })
    ]);

    const masteryRate = totalCards > 0 ? (masteredCount / totalCards * 100).toFixed(1) : 0;

    return {
        overdueCount,
        waitingCount,
        frozenCount,
        totalCards,
        masteredCount,
        masteryRate: parseFloat(masteryRate),
        reviewableCount: overdueCount
    };
}

module.exports = {
    createManualFolder,
    createManualIdiomFolder,
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
    ensureCardsForIdioms,
    validateFolderContentType,
    getAvailableCardsForReview: getAvailableCardsForReviewFixed,
    getWaitingCardsCount,
    getSrsStatus,
    checkAndUpdateFolderMasteryStatus,
    checkAndUpdateParentFolderMasteryStatus
};
