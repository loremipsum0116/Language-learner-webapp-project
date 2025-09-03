// server/services/wrongAnswerService.js
const { prisma } = require('../lib/prismaClient');
const dayjs = require('dayjs');

/**
 * 오답을 오답노트에 추가합니다.
 * @param {number} userId 
 * @param {number} vocabId 
 * @param {number} folderId - 폴더별 독립적인 오답 관리를 위한 폴더 ID
 * @returns {Object} 생성된 오답노트 항목
 */
async function addWrongAnswer(userId, vocabId, folderId = null) {
  console.log(`[WRONG ANSWER SERVICE] Starting addWrongAnswer: userId=${userId}, vocabId=${vocabId}, folderId=${folderId}`);
  // 타임머신 시간 오프셋 적용
  const { getOffsetDate } = require('../routes/timeMachine');
  const wrongAt = dayjs(getOffsetDate());
  
  // SRS 곡선에 맞는 복습 기간 계산
  let reviewDelayHours = 24; // 기본값: 1일 후
  
  try {
    // 해당 단어의 SRS 카드 찾기
    const srsCard = await prisma.srscard.findFirst({
      where: {
        userId,
        itemType: 'vocab',
        itemId: vocabId
      }
    });
    
    if (srsCard) {
      // SRS 스케줄 로직 import
      const { STAGE_DELAYS } = require('./srsSchedule');
      
      // 현재 stage에 따른 복습 간격 설정 (오답시에는 좀 더 짧게)
      const stage = Math.max(0, srsCard.stage - 1); // 오답시 한 스테이지 뒤로
      const stageIndex = Math.min(stage, STAGE_DELAYS.length - 1);
      const delayDays = STAGE_DELAYS[stageIndex];
      reviewDelayHours = Math.max(1, delayDays * 24); // 최소 1시간
      
      console.log(`[WRONG ANSWER SERVICE] SRS card found - stage: ${srsCard.stage}, adjusted stage: ${stage}, delay: ${reviewDelayHours}h`);
    } else {
      console.log(`[WRONG ANSWER SERVICE] No SRS card found, using default 24h delay`);
    }
  } catch (error) {
    console.error(`[WRONG ANSWER SERVICE] Error finding SRS card:`, error);
    // 에러 시 기본값 사용
  }
  
  // 복습 윈도우: 계산된 시간 후부터 그 다음날까지
  const reviewWindowStart = wrongAt.add(reviewDelayHours, 'hour');
  const reviewWindowEnd = reviewWindowStart.add(24, 'hour'); // 24시간 복습 윈도우
  
  // 오답 히스토리를 위해 항상 새로운 레코드 생성
  console.log(`[WRONG ANSWER SERVICE] Creating new wrong answer history record`);
  
  // 현재 틀린 횟수 계산 (같은 단어의 기존 오답 개수 + 1)
  // 삭제된 폴더의 오답노트는 제외하고 카운트
  let existingCount = 0;
  
  if (folderId) {
    // 폴더별 독립: 해당 폴더가 실제로 존재하는지 먼저 확인
    const folderExists = await prisma.srsfolder.findUnique({
      where: { id: folderId },
      select: { id: true }
    });
    
    if (folderExists) {
      // 폴더가 존재하면 해당 폴더의 오답만 카운트
      existingCount = await prisma.wronganswer.count({
        where: { userId, vocabId, folderId }
      });
    } else {
      console.log(`[WRONG ANSWER SERVICE] Folder ${folderId} does not exist - starting fresh`);
      existingCount = 0; // 폴더가 없으면 새로 시작
    }
  } else {
    // 전역 관리 (하위호환): folderId가 null인 것만
    existingCount = await prisma.wronganswer.count({
      where: { userId, vocabId, folderId: null }
    });
  }
  
  const currentAttempts = existingCount + 1;
  console.log(`[WRONG ANSWER SERVICE] This will be attempt #${currentAttempts} for this vocab (existing: ${existingCount})`);
  
  
  // 새로운 오답노트 항목 생성 (히스토리로 관리)
  console.log(`[WRONG ANSWER SERVICE] Creating new wrong answer history entry`);
  const createData = {
    userId,
    vocabId,
    wrongAt: wrongAt.toDate(),
    reviewWindowStart: reviewWindowStart.toDate(),
    reviewWindowEnd: reviewWindowEnd.toDate(),
    attempts: currentAttempts
  };
  
  // folderId가 제공된 경우에만 추가
  if (folderId) {
    createData.folderId = folderId;
  }
  
  console.log(`[WRONG ANSWER SERVICE] Create data:`, createData);
  
  const created = await prisma.wronganswer.create({
    data: createData,
    include: {
      vocab: {
        include: {
          dictentry: true
        }
      }
    }
  });
  
  console.log(`[WRONG ANSWER SERVICE] Created result:`, created);
  return created;
}

/**
 * 오답노트 복습 성공 처리
 * @param {number} userId 
 * @param {number} vocabId 
 * @param {number} folderId - 폴더별 독립적인 오답 관리를 위한 폴더 ID
 * @returns {boolean} 성공 여부
 */
async function completeWrongAnswer(userId, vocabId, folderId = null) {
  // 타임머신 시간 오프셋 적용
  const { getOffsetDate } = require('../routes/timeMachine');
  const now = dayjs(getOffsetDate());
  
  // folderId가 제공된 경우 폴더별 독립적 관리, 없으면 기존 방식 (전역 관리)
  const whereCondition = folderId 
    ? { userId, vocabId, folderId, isCompleted: false, reviewWindowStart: { lte: now.toDate() }, reviewWindowEnd: { gte: now.toDate() } }
    : { userId, vocabId, isCompleted: false, reviewWindowStart: { lte: now.toDate() }, reviewWindowEnd: { gte: now.toDate() } };
  
  // 현재 활성화된 복습 윈도우 내의 오답노트 찾기
  const wrongAnswer = await prisma.wronganswer.findFirst({
    where: whereCondition
  });
  
  if (!wrongAnswer) {
    // 복습 윈도우가 아니거나 해당 오답노트가 없음
    return false;
  }
  
  // 오답노트 완료 처리
  await prisma.wronganswer.update({
    where: { id: wrongAnswer.id },
    data: {
      isCompleted: true,
      reviewedAt: now.toDate()
    }
  });
  
  return true;
}

/**
 * 사용자의 오답노트 목록 조회
 * @param {number} userId 
 * @param {boolean} includeCompleted 완료된 항목도 포함할지 여부
 * @param {number} folderId 특정 폴더의 오답만 조회 (null이면 전체)
 * @returns {Array} 오답노트 목록
 */
async function getWrongAnswers(userId, includeCompleted = false, folderId = null) {
  console.log(`[WRONG ANSWER SERVICE] Getting wrong answers: userId=${userId}, includeCompleted=${includeCompleted}, folderId=${folderId}`);
  
  try {
    // 타임머신 시간 오프셋 적용
    const { getOffsetDate } = require('../routes/timeMachine');
    const now = dayjs(getOffsetDate());
    console.log(`[WRONG ANSWER SERVICE] Current time: ${now.format()}`);
    
    // 데이터베이스 연결 테스트
    await prisma.$queryRaw`SELECT 1`;
    
    // 기본 where 조건
    const whereCondition = {
      userId,
      isCompleted: includeCompleted ? undefined : false
    };
    
    // folderId가 제공된 경우 폴더별 필터링 추가
    if (folderId !== null) {
      whereCondition.folderId = folderId;
    }
    
    const wrongAnswers = await prisma.wronganswer.findMany({
      where: whereCondition,
      include: {
        vocab: {
          include: {
            dictentry: true
          }
        },
        folder: folderId ? true : false // folderId가 지정된 경우에만 folder 정보 포함
      },
      orderBy: [
        { isCompleted: 'asc' },
        { wrongAt: 'desc' }
      ]
    });
    
    console.log(`[WRONG ANSWER SERVICE] Found ${wrongAnswers.length} wrong answers`);
    
    // 각 항목에 복습 상태 정보 추가
    const result = wrongAnswers.map((wa, index) => {
      try {
        const reviewWindowStart = dayjs(wa.reviewWindowStart);
        const reviewWindowEnd = dayjs(wa.reviewWindowEnd);
        
        let reviewStatus = 'pending'; // 아직 복습 시간 전
        try {
          if (now.isAfter(reviewWindowEnd)) {
            reviewStatus = 'overdue'; // 복습 시간 지남
          } else if (now.isBetween(reviewWindowStart, reviewWindowEnd, null, '[]')) {
            reviewStatus = 'available'; // 복습 가능 시간
          }
        } catch (dateError) {
          console.error(`[WRONG ANSWER SERVICE] Date comparison error for item ${index}:`, dateError);
          reviewStatus = 'pending'; // 기본값으로 설정
        }
        
        return {
          ...wa,
          reviewStatus,
          canReview: reviewStatus === 'available' || reviewStatus === 'overdue',
          timeUntilReview: reviewStatus === 'pending' ? (
            reviewWindowStart.isValid() ? reviewWindowStart.diff(now, 'hour') : 0
          ) : 0
        };
      } catch (itemError) {
        console.error(`[WRONG ANSWER SERVICE] Error processing item ${index}:`, itemError);
        // 기본 정보만 반환
        return {
          ...wa,
          reviewStatus: 'pending',
          canReview: false,
          timeUntilReview: 0
        };
      }
    });
    
    console.log(`[WRONG ANSWER SERVICE] Successfully processed ${result.length} items`);
    return result;
    
  } catch (error) {
    console.error(`[WRONG ANSWER SERVICE] Error in getWrongAnswers:`, error);
    throw error;
  }
}

/**
 * 현재 복습 가능한 오답노트 개수 조회
 * @param {number} userId 
 * @param {number} folderId 특정 폴더의 오답만 카운트 (null이면 전체)
 * @returns {number} 복습 가능한 개수
 */
async function getAvailableWrongAnswersCount(userId, folderId = null) {
  // 타임머신 시간 오프셋 적용
  const { getOffsetDate } = require('../routes/timeMachine');
  const now = dayjs(getOffsetDate());
  
  // 기본 where 조건
  const whereCondition = {
    userId,
    isCompleted: false,
    reviewWindowStart: { lte: now.toDate() }
  };
  
  // folderId가 제공된 경우 폴더별 필터링 추가
  if (folderId !== null) {
    whereCondition.folderId = folderId;
  }
  
  const count = await prisma.wronganswer.count({
    where: whereCondition
  });
  
  return count;
}

/**
 * 복습 가능한 오답노트로 퀴즈 데이터 생성
 * @param {number} userId 
 * @param {number} limit 최대 문제 수
 * @param {number} folderId 특정 폴더의 오답만 포함 (null이면 전체)
 * @returns {Array} 퀴즈 데이터
 */
async function generateWrongAnswerQuiz(userId, limit = 10, folderId = null) {
  console.log(`[WRONG ANSWER QUIZ] Generating quiz for userId=${userId}, limit=${limit}, folderId=${folderId}`);
  
  // 기본 where 조건
  const whereCondition = {
    userId,
    isCompleted: false
    // 복습 윈도우 체크 제거 - 모든 미완료 오답 포함
  };
  
  // folderId가 제공된 경우 폴더별 필터링 추가
  if (folderId !== null) {
    whereCondition.folderId = folderId;
  }
  
  const wrongAnswers = await prisma.wronganswer.findMany({
    where: whereCondition,
    include: {
      vocab: {
        include: {
          dictentry: true
        }
      },
      folder: folderId ? true : false // folderId가 지정된 경우에만 folder 정보 포함
    },
    take: limit,
    orderBy: { wrongAt: 'asc' } // 오래된 것부터
  });
  
  console.log(`[WRONG ANSWER QUIZ] Found ${wrongAnswers.length} wrong answers for quiz`);
  
  // 퀴즈 형태로 변환
  const quizItems = wrongAnswers.map(wa => ({
    wrongAnswerId: wa.id,
    vocabId: wa.vocab.id,
    lemma: wa.vocab.lemma,
    pos: wa.vocab.pos,
    definition: wa.vocab.dictentry?.examples?.[0]?.definition || '',
    example: wa.vocab.dictentry?.examples?.[0]?.example || '',
    koGloss: wa.vocab.dictentry?.examples?.[0]?.koGloss || '',
    attempts: wa.attempts,
    wrongAt: wa.wrongAt,
    reviewWindowEnd: wa.reviewWindowEnd
  }));
  
  console.log(`[WRONG ANSWER QUIZ] Returning ${quizItems.length} quiz items`);
  return quizItems;
}

/**
 * 만료된 복습 윈도우 정리 (일일 정리 작업)
 */
async function cleanupExpiredReviewWindows() {
  // 타임머신 시간 오프셋 적용
  const { getOffsetDate } = require('../routes/timeMachine');
  const threeDaysAgo = dayjs(getOffsetDate()).subtract(3, 'day');
  
  // 3일 이상 지난 미완료 오답노트들을 완료 처리 또는 삭제
  const expiredWrongAnswers = await prisma.wronganswer.updateMany({
    where: {
      reviewWindowEnd: { lt: threeDaysAgo.toDate() },
      isCompleted: false
    },
    data: {
      isCompleted: true,
      reviewedAt: new Date() // 자동 완료 처리
    }
  });
  
  console.log(`Cleaned up ${expiredWrongAnswers.count} expired wrong answers`);
  return expiredWrongAnswers.count;
}

module.exports = {
  addWrongAnswer,
  completeWrongAnswer,
  getWrongAnswers,
  getAvailableWrongAnswersCount,
  generateWrongAnswerQuiz,
  cleanupExpiredReviewWindows
};