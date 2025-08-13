// server/services/wrongAnswerService.js
const { prisma } = require('../lib/prismaClient');
const dayjs = require('dayjs');

/**
 * 오답을 오답노트에 추가합니다.
 * @param {number} userId 
 * @param {number} vocabId 
 * @returns {Object} 생성된 오답노트 항목
 */
async function addWrongAnswer(userId, vocabId) {
  console.log(`[WRONG ANSWER SERVICE] Starting addWrongAnswer: userId=${userId}, vocabId=${vocabId}`);
  // 타임머신 시간 오프셋 적용
  const { getOffsetDate } = require('../routes/timeMachine');
  const wrongAt = dayjs(getOffsetDate());
  
  // 복습 윈도우: 틀린 시각 다음날 같은 시각부터 그 다음날 같은 시각까지
  const reviewWindowStart = wrongAt.add(1, 'day');
  const reviewWindowEnd = wrongAt.add(2, 'day');
  
  // 이미 같은 단어로 미완료된 오답노트가 있는지 확인
  console.log(`[WRONG ANSWER SERVICE] Checking for existing wrong answer`);
  const existingWrongAnswer = await prisma.wrongAnswer.findFirst({
    where: {
      userId,
      vocabId,
      isCompleted: false
    }
  });
  console.log(`[WRONG ANSWER SERVICE] Existing wrong answer found:`, existingWrongAnswer);
  
  if (existingWrongAnswer) {
    // 기존 항목의 attempts 증가하고 최신 정보로 업데이트
    console.log(`[WRONG ANSWER SERVICE] Updating existing wrong answer`);
    return await prisma.wrongAnswer.update({
      where: { id: existingWrongAnswer.id },
      data: {
        attempts: existingWrongAnswer.attempts + 1,
        wrongAt: wrongAt.toDate(), // 최신 오답 시각으로 업데이트
        reviewWindowStart: reviewWindowStart.toDate(),
        reviewWindowEnd: reviewWindowEnd.toDate()
        // 가장 최근에 틀린 폴더 정보는 quiz.js에서 추가로 처리 필요
      },
      include: {
        vocab: {
          include: {
            dictMeta: true
          }
        }
      }
    });
  }
  
  // 새로운 오답노트 항목 생성
  console.log(`[WRONG ANSWER SERVICE] Creating new wrong answer`);
  const createData = {
    userId,
    vocabId,
    wrongAt: wrongAt.toDate(),
    reviewWindowStart: reviewWindowStart.toDate(),
    reviewWindowEnd: reviewWindowEnd.toDate(),
    attempts: 1
  };
  console.log(`[WRONG ANSWER SERVICE] Create data:`, createData);
  
  const created = await prisma.wrongAnswer.create({
    data: createData,
    include: {
      vocab: {
        include: {
          dictMeta: true
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
 * @returns {boolean} 성공 여부
 */
async function completeWrongAnswer(userId, vocabId) {
  // 타임머신 시간 오프셋 적용
  const { getOffsetDate } = require('../routes/timeMachine');
  const now = dayjs(getOffsetDate());
  
  // 현재 활성화된 복습 윈도우 내의 오답노트 찾기
  const wrongAnswer = await prisma.wrongAnswer.findFirst({
    where: {
      userId,
      vocabId,
      isCompleted: false,
      reviewWindowStart: { lte: now.toDate() },
      reviewWindowEnd: { gte: now.toDate() }
    }
  });
  
  if (!wrongAnswer) {
    // 복습 윈도우가 아니거나 해당 오답노트가 없음
    return false;
  }
  
  // 오답노트 완료 처리
  await prisma.wrongAnswer.update({
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
 * @returns {Array} 오답노트 목록
 */
async function getWrongAnswers(userId, includeCompleted = false) {
  console.log(`[WRONG ANSWER SERVICE] Getting wrong answers: userId=${userId}, includeCompleted=${includeCompleted}`);
  
  try {
    // 타임머신 시간 오프셋 적용
    const { getOffsetDate } = require('../routes/timeMachine');
    const now = dayjs(getOffsetDate());
    
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
 * @returns {number} 복습 가능한 개수
 */
async function getAvailableWrongAnswersCount(userId) {
  // 타임머신 시간 오프셋 적용
  const { getOffsetDate } = require('../routes/timeMachine');
  const now = dayjs(getOffsetDate());
  
  const count = await prisma.wrongAnswer.count({
    where: {
      userId,
      isCompleted: false,
      reviewWindowStart: { lte: now.toDate() }
    }
  });
  
  return count;
}

/**
 * 복습 가능한 오답노트로 퀴즈 데이터 생성
 * @param {number} userId 
 * @param {number} limit 최대 문제 수
 * @returns {Array} 퀴즈 데이터
 */
async function generateWrongAnswerQuiz(userId, limit = 10) {
  console.log(`[WRONG ANSWER QUIZ] Generating quiz for userId=${userId}, limit=${limit}`);
  
  const wrongAnswers = await prisma.wrongAnswer.findMany({
    where: {
      userId,
      isCompleted: false
      // 복습 윈도우 체크 제거 - 모든 미완료 오답 포함
    },
    include: {
      vocab: {
        include: {
          dictMeta: true
        }
      }
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
    definition: wa.vocab.dictMeta?.examples?.[0]?.definition || '',
    example: wa.vocab.dictMeta?.examples?.[0]?.example || '',
    koGloss: wa.vocab.dictMeta?.examples?.[0]?.koGloss || '',
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
  const expiredWrongAnswers = await prisma.wrongAnswer.updateMany({
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