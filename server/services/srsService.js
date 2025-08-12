//server/services/srsService.js
const { prisma } = require('../lib/prismaClient');
const createError = require('http-errors');
const { 
  computeNextReviewDate,
  computeWaitingUntil,
  computeWrongAnswerWaitingUntil,
  computeOverdueDeadline 
} = require('./srsSchedule');
const { startOfKstDay, addKstDays, isCardInWaitingPeriod, isCardOverdue, hasOverdueCards } = require('./srsJobs');
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

// 이 함수는 새 로직에서 사용하지 않으므로 제거하거나 사용하지 않음
// nextReviewAtFor 함수는 markAnswer 함수 내에서 새 로직으로 대체됨

/**
 * 새로운 SRS 시스템의 정답/오답 처리
 * 새 로직: 대기 시간 동안은 상태 변화 없음, overdue 상태에서만 학습 가능
 */
async function markAnswer(userId, { folderId, cardId, correct, vocabId }) {
    const now = new Date();
    
    // 카드 정보 조회 (새 필드들 포함)
    const card = await prisma.sRSCard.findFirst({ 
        where: { id: cardId, userId },
        select: {
            id: true,
            stage: true,
            isFromWrongAnswer: true,
            wrongStreakCount: true,
            isOverdue: true,
            waitingUntil: true,
            overdueDeadline: true,
            itemType: true,
            itemId: true
        }
    });
    
    if (!card) throw new Error('카드를 찾을 수 없습니다.');
    
    // vocabId가 전달되지 않은 경우 카드에서 조회
    if (!vocabId && card.itemType === 'vocab') {
        vocabId = card.itemId;
    }

    // 학습 가능 여부와 관계없이 폴더에서의 학습 상태는 항상 업데이트
    let canUpdateCardState = true;
    let statusMessage = '';
    
    // 대기 중인 카드는 카드 상태 변화 없음 (하지만 폴더에서는 학습 완료 표시)
    if (isCardInWaitingPeriod(card)) {
        console.log(`[SRS SERVICE] Card ${cardId} is in waiting period - no card state change`);
        canUpdateCardState = false;
        statusMessage = '아직 대기 시간입니다. 카드 상태는 변경되지 않지만 학습은 완료로 표시됩니다.';
    }

    // overdue 상태가 아니어도 학습 자체는 가능 (카드 상태만 변경 안됨)
    if (!isCardOverdue(card) && canUpdateCardState) {
        console.log(`[SRS SERVICE] Card ${cardId} is not in overdue state - no card state change`);
        canUpdateCardState = false;
        statusMessage = '아직 복습 시기가 아닙니다. 카드 상태는 변경되지 않지만 학습은 완료로 표시됩니다.';
    }

    let newStage = card.stage, waitingUntil, nextReviewAt;
    
    // 항상 다음 상태를 계산 (실제 업데이트와 별개)
    let calculatedStage = newStage;
    let calculatedWaitingUntil, calculatedNextReviewAt;
    
    console.log(`[SRS SERVICE] Calculating next state: current stage=${card.stage}, correct=${correct}`);
    
    if (correct) {
        // 정답 시 다음 상태 계산
        calculatedStage = Math.min(card.stage + 1, 6);
        
        if (card.stage === 6 && calculatedStage === 6) {
            // 마스터 완료 시
            calculatedStage = 0;
            calculatedWaitingUntil = null;
            calculatedNextReviewAt = null;
            console.log(`[SRS SERVICE] Mastery achieved - resetting to stage 0`);
        } else {
            calculatedWaitingUntil = computeWaitingUntil(now, calculatedStage);
            calculatedNextReviewAt = computeNextReviewDate(now, calculatedStage);
            console.log(`[SRS SERVICE] Correct answer - stage ${card.stage} → ${calculatedStage}, nextReviewAt: ${calculatedNextReviewAt}`);
        }
    } else {
        // 오답 시 다음 상태 계산
        calculatedStage = 0;
        calculatedWaitingUntil = computeWrongAnswerWaitingUntil(now);
        calculatedNextReviewAt = null;
        console.log(`[SRS SERVICE] Wrong answer - reset to stage 0, waitingUntil: ${calculatedWaitingUntil}`);
    }

    // 카드 상태 업데이트가 가능한 경우에만 실제 업데이트 실행
    if (canUpdateCardState && correct) {
        // 정답 처리
        newStage = calculatedStage;
        waitingUntil = calculatedWaitingUntil;
        nextReviewAt = calculatedNextReviewAt;
        
        if (card.isFromWrongAnswer) {
            // 오답 단어가 정답을 맞춘 경우 → 정답 단어와 동일한 타이머 설정
            
            // Stage 6에서 정답 시 120일 마스터 완료 처리
            if (card.stage === 6 && calculatedStage === 0) {
                await prisma.sRSCard.update({
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
                        correctTotal: { increment: 1 }
                    }
                });
                
                console.log(`[SRS SERVICE] 🌟 MASTERY ACHIEVED! Card ${cardId} completed 120-day cycle`);
                newStage = 0; // 변수 업데이트
                
            } else {
                await prisma.sRSCard.update({
                    where: { id: cardId },
                    data: {
                        stage: newStage,
                        nextReviewAt: nextReviewAt,
                        waitingUntil: waitingUntil,
                        isOverdue: false,
                        overdueDeadline: null,
                        overdueStartAt: null,
                        isFromWrongAnswer: false, // 정답 처리로 일반 카드로 전환
                        wrongStreakCount: 0, // 연속 오답 리셋
                        correctTotal: { increment: 1 }
                    }
                });
            }
            
        } else {
            // 일반 단어가 정답을 맞춘 경우 → stage 증가 후 (n-1)일 대기
            
            // Stage 6에서 정답 시 120일 마스터 완료 처리
            if (card.stage === 6 && calculatedStage === 0) {
                await prisma.sRSCard.update({
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
                        correctTotal: { increment: 1 }
                    }
                });
                
                console.log(`[SRS SERVICE] 🌟 MASTERY ACHIEVED! Card ${cardId} completed 120-day cycle`);
                newStage = 0; // 변수 업데이트
                
            } else {
                await prisma.sRSCard.update({
                    where: { id: cardId },
                    data: {
                        stage: newStage,
                        nextReviewAt: nextReviewAt,
                        waitingUntil: waitingUntil,
                        isOverdue: false,
                        overdueDeadline: null,
                        overdueStartAt: null,
                        correctTotal: { increment: 1 }
                    }
                });
            }
        }
        
        console.log(`[SRS SERVICE] Correct answer for card ${cardId} - stage ${card.stage} → ${newStage}`);
        
    } else if (canUpdateCardState && !correct) {
        // 오답 처리 → 24시간 대기 후 overdue (카드 상태 업데이트 가능할 때만)
        newStage = calculatedStage;
        waitingUntil = calculatedWaitingUntil;
        nextReviewAt = calculatedNextReviewAt;
        
        await prisma.sRSCard.update({
            where: { id: cardId },
            data: {
                stage: 0, // stage 0으로 리셋
                nextReviewAt: null,
                waitingUntil: waitingUntil,
                isOverdue: false,
                overdueDeadline: null,
                overdueStartAt: null,
                isFromWrongAnswer: true,
                wrongStreakCount: { increment: 1 },
                wrongTotal: { increment: 1 }
            }
        });
        
        console.log(`[SRS SERVICE] Wrong answer for card ${cardId} - reset to stage 0`);
    } else if (!canUpdateCardState && !correct) {
        // 카드 상태는 업데이트할 수 없지만 오답 통계는 업데이트
        // 계산된 값들을 반환용으로 설정
        newStage = calculatedStage;
        waitingUntil = calculatedWaitingUntil;
        nextReviewAt = calculatedNextReviewAt;
        
        await prisma.sRSCard.update({
            where: { id: cardId },
            data: {
                wrongTotal: { increment: 1 }
            }
        });
        
        console.log(`[SRS SERVICE] Card ${cardId} - no state change but recorded wrong answer`);
    } else if (!canUpdateCardState && correct) {
        // 카드 상태는 업데이트할 수 없지만 정답 통계는 업데이트
        // 계산된 값들을 반환용으로 설정
        newStage = calculatedStage;
        waitingUntil = calculatedWaitingUntil;
        nextReviewAt = calculatedNextReviewAt;
        
        await prisma.sRSCard.update({
            where: { id: cardId },
            data: {
                correctTotal: { increment: 1 }
            }
        });
        
        console.log(`[SRS SERVICE] Card ${cardId} - no state change but recorded correct answer`);
    } else {
        console.log(`[SRS SERVICE] Card ${cardId} - no state change (canUpdateCardState: ${canUpdateCardState}, correct: ${correct})`);
    }

    // --- SrsFolderItem Update ---
    if (folderId) {
        await prisma.srsFolderItem.updateMany({
            where: { folderId: folderId, cardId: cardId },
            data: {
                lastReviewedAt: now,
                learned: correct,
                wrongCount: { increment: correct ? 0 : 1 },
            }
        });
    }

    // --- 연속 학습 일수 업데이트 ---
    const { updateUserStreak } = require('./streakService');
    const streakInfo = await updateUserStreak(userId);

    // --- 오답노트 처리 ---
    if (!correct && vocabId) {
        console.log(`[SRS SERVICE] Adding to wrong answer note: userId=${userId}, vocabId=${vocabId}`);
        const { addWrongAnswer } = require('./wrongAnswerService');
        await addWrongAnswer(userId, vocabId);
        console.log(`[SRS SERVICE] Successfully added to wrong answer note`);
    } else if (!correct) {
        console.log(`[SRS SERVICE] Wrong answer but no vocabId - skipping wrong answer note`);
    }

    // --- 일일 학습 통계 업데이트 ---
    await bumpDailyStat(userId, { srsSolvedInc: 1 });
    
    // --- 사용자 overdue 상태 업데이트 ---
    try {
        const now = new Date();
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

    return { 
        status: correct ? 'correct' : 'wrong',
        newStage: newStage,
        waitingUntil: waitingUntil,
        nextReviewAt: nextReviewAt,
        streakInfo: streakInfo,
        canUpdateCardState: canUpdateCardState,
        message: statusMessage || (correct ? '정답입니다!' : '오답입니다.')
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

/**
 * 사용자의 현재 학습 가능한 카드들을 조회합니다.
 * overdue 상태이면서 데드라인이 지나지 않은 카드들만 반환합니다.
 */
async function getAvailableCardsForReview(userId) {
    const now = new Date();
    
    const cards = await prisma.sRSCard.findMany({
        where: {
            userId: userId,
            isOverdue: true,
            overdueDeadline: { gt: now }
        },
        include: {
            folderItems: {
                include: {
                    vocab: true
                }
            }
        },
        orderBy: [
            { isFromWrongAnswer: 'desc' }, // 오답 단어 우선
            { overdueStartAt: 'asc' } // 오래된 overdue부터
        ]
    });

    return cards;
}

/**
 * 사용자의 대기 중인 카드 수를 조회합니다.
 */
async function getWaitingCardsCount(userId) {
    const now = new Date();
    
    const count = await prisma.sRSCard.count({
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
    
    const [overdueCount, waitingCount, totalCards, masteredCount] = await Promise.all([
        prisma.sRSCard.count({
            where: {
                userId: userId,
                isOverdue: true,
                overdueDeadline: { gt: now }
            }
        }),
        prisma.sRSCard.count({
            where: {
                userId: userId,
                waitingUntil: { gt: now },
                isOverdue: false
            }
        }),
        prisma.sRSCard.count({
            where: { userId: userId }
        }),
        prisma.sRSCard.count({
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
        totalCards,
        masteredCount,
        masteryRate: parseFloat(masteryRate),
        reviewableCount: overdueCount
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
    getAvailableCardsForReview,
    getWaitingCardsCount,
    getSrsStatus
};
