// server/routes/odat-note.js
const express = require('express');
const router = express.Router();
const { prisma } = require('../lib/prismaClient');
const { generateMcqQuizItems } = require('../services/quizService');
const auth = require('../middleware/auth');
const { formatKstDateTime } = require('../lib/kst');

// ✅ 이 파일의 모든 라우트는 로그인 필요
router.use(auth);

/**
 * POST /odat-note/resolve-many
 * 오답노트에서 선택한 카드들의 누적 오답을 0으로 초기화
 * body: { cardIds: number[] }
 */
router.post('/resolve-many', async (req, res) => {
  try {
    const { cardIds } = req.body || {};
    if (!Array.isArray(cardIds) || cardIds.length === 0) {
      return res.status(400).json({ error: 'cardIds must be a non-empty array' });
    }

    const result = await prisma.srscard.updateMany({
      where: {
        userId: req.user.id,
        id: { in: cardIds.map(Number) },
      },
      data: {
        wrongTotal: 0, // ✅ 스키마에 맞게 수정 (incorrectCount 제거)
      },
    });

    return res.json({ data: { count: result.count } });
  } catch (e) {
    console.error('POST /odat-note/resolve-many failed:', e);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

/**
 * POST /odat-note/quiz
 * 선택한 카드들만으로 MCQ 큐 생성
 * body: { cardIds: number[] }
 */
router.post('/quiz', async (req, res) => {
  try {
    const { cardIds } = req.body || {};
    if (!Array.isArray(cardIds) || cardIds.length === 0) {
      return res.json({ data: [] });
    }

    const cards = await prisma.srscard.findMany({
      where: {
        userId: req.user.id,
        id: { in: cardIds.map(Number) },
      },
      select: { itemId: true },
    });

    const vocabIds = cards.map((c) => c.itemId);
    if (vocabIds.length === 0) return res.json({ data: [] });

    const quizQueue = await generateMcqQuizItems(prisma, req.user.id, vocabIds);
    return res.json({ data: quizQueue });
  } catch (e) {
    console.error('POST /odat-note/quiz failed:', e);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

/**
 * GET /odat-note/list?type=vocab|grammar|reading|listening
 * 카테고리별 오답노트 목록
 * 프론트에서 테이블/리스트로 보여줄 때 사용
 */
router.get('/list', async (req, res) => {
  try {
    const { type = 'vocab' } = req.query;
    
    // 지원되는 타입 체크
    const validTypes = ['vocab', 'grammar', 'reading', 'listening'];
    if (!validTypes.includes(type)) {
      return res.status(400).json({ error: 'Invalid type. Must be one of: vocab, grammar, reading, listening' });
    }
    
    // 새로운 WrongAnswer 모델에서 미완료 오답들을 카테고리별로 조회
    // reading 타입의 경우 japanese-reading도 포함, listening 타입의 경우 japanese-listening도 포함
    let itemTypes = [type];
    if (type === 'reading') {
      itemTypes = ['reading', 'japanese-reading'];
    } else if (type === 'listening') {
      itemTypes = ['listening', 'japanese-listening'];
    }

    const baseWhere = {
      userId: req.user.id,
      isCompleted: false,
      itemType: { in: itemTypes }
    };
    
    // Raw SQL 쿼리를 Prisma ORM 쿼리로 변경하여 translations을 포함
    const wrongAnswers = await prisma.wronganswer.findMany({
      where: baseWhere,
      include: {
        vocab: {
          include: {
            dictentry: true,
            translations: {
              include: {
                language: true
              }
            }
          }
        }
      },
      orderBy: [
        { attempts: 'desc' },
        { wrongAt: 'desc' }
      ],
      take: 200
    });

    // SRS 카드 정보를 별도로 조회
    const vocabIds = wrongAnswers.filter(wa => wa.itemType === 'vocab').map(wa => wa.vocabId);
    const srsCards = vocabIds.length > 0 ? await prisma.srscard.findMany({
      where: {
        userId: req.user.id,
        itemType: 'vocab',
        itemId: { in: vocabIds }
      }
    }) : [];

    // SRS 카드를 vocabId별로 매핑
    const srsCardMap = new Map();
    srsCards.forEach(card => {
      srsCardMap.set(card.itemId, card);
    });

    const data = wrongAnswers.map((wa) => {
      // SRS 카드 정보 가져오기
      const srsCard = wa.itemType === 'vocab' ? srsCardMap.get(wa.vocabId) : null;

      // gloss 찾기(있으면)
      let gloss = null;
      if (wa.vocab?.dictentry?.examples) {
        try {
          const ex = Array.isArray(wa.vocab.dictentry.examples) ? wa.vocab.dictentry.examples : JSON.parse(wa.vocab.dictentry.examples || '[]');
          const g = ex.find((e) => e && e.kind === 'gloss');
          if (g && typeof g.ko === 'string') gloss = g.ko;
        } catch (e) {
          // JSON 파싱 에러 무시
        }
      }

      const result = {
        id: wa.id, // 프론트엔드에서 기대하는 id 필드
        wrongAnswerId: wa.id, // 호환성을 위해 유지
        itemType: wa.itemType,
        itemId: wa.itemId,
        attempts: wa.attempts,
        wrongAt: wa.wrongAt,
        reviewWindowStart: wa.reviewWindowStart,
        reviewWindowEnd: wa.reviewWindowEnd,
        canReview: new Date() >= wa.reviewWindowStart && new Date() <= wa.reviewWindowEnd,
        wrongData: wa.wrongData
      };

      // SRS 카드 정보 추가 (vocab 타입에만 적용)
      if (wa.itemType === 'vocab' && srsCard) {
        result.srsCard = {
          id: srsCard.id,
          stage: srsCard.stage || 0,
          nextReviewAt: srsCard.nextReviewAt,
          waitingUntil: srsCard.waitingUntil,
          isOverdue: Boolean(srsCard.isOverdue),
          overdueDeadline: srsCard.overdueDeadline,
          isFromWrongAnswer: Boolean(srsCard.isFromWrongAnswer),
          frozenUntil: srsCard.frozenUntil,
          isMastered: Boolean(srsCard.isMastered),
          masterCycles: srsCard.masterCycles || 0,
          masteredAt: srsCard.masteredAt,
          correctTotal: srsCard.correctTotal || 0,
          wrongTotal: srsCard.wrongTotal || 0
        };

        // 어휘 타입에서는 SRS 대기 시간을 고려하여 canReview 재계산
        const now = new Date();
        if (srsCard.waitingUntil) {
          const waitingUntil = new Date(srsCard.waitingUntil);
          result.canReview = now >= waitingUntil && now >= wa.reviewWindowStart && now <= wa.reviewWindowEnd;
        } else if (srsCard.nextReviewAt) {
          const nextReviewAt = new Date(srsCard.nextReviewAt);
          result.canReview = now >= nextReviewAt && now >= wa.reviewWindowStart && now <= wa.reviewWindowEnd;
        }
      } else if (wa.itemType === 'vocab') {
        // SRS 카드가 없는 경우 null로 설정
        result.srsCard = null;
      }

      // 타입별 추가 정보
      if (wa.itemType === 'vocab') {
        result.vocabId = wa.vocabId;
        result.lemma = wa.vocab?.lemma ?? '';
        result.pos = wa.vocab?.pos ?? '';
        result.levelCEFR = wa.vocab?.levelCEFR ?? '';
        result.ipa = wa.vocab?.dictentry?.ipa ?? null;
        result.ipaKo = wa.vocab?.dictentry?.ipaKo ?? null;
        result.ko_gloss = gloss;

        // 오답노트 전용 횟수 추가 (attempts는 이미 오답노트 기록 횟수)
        result.totalWrongAttempts = wa.attempts || 0;

        // 프론트엔드가 기대하는 vocab 객체 구조 생성 (translations 포함)
        result.vocab = {
          id: wa.vocabId,
          lemma: wa.vocab?.lemma ?? '',
          pos: wa.vocab?.pos ?? '',
          levelCEFR: wa.vocab?.levelCEFR ?? '',
          dictentry: {
            ipa: wa.vocab?.dictentry?.ipa ?? null,
            ipaKo: wa.vocab?.dictentry?.ipaKo ?? null,
            examples: wa.vocab?.dictentry?.examples
          },
          translations: wa.vocab?.translations || []
        };
      } else if (wa.itemType === 'grammar') {
        result.grammarId = wa.itemId;
        result.topic = wa.wrongData?.topic || 'Unknown Topic';
        result.rule = wa.wrongData?.rule || '';
      } else if (wa.itemType === 'reading') {
        result.readingId = wa.itemId;
        result.title = wa.wrongData?.title || 'Unknown Title';
        result.passage = wa.wrongData?.passage || '';
      } else if (wa.itemType === 'listening') {
        result.listeningId = wa.itemId;
        result.title = wa.wrongData?.title || 'Unknown Title';
        result.audioUrl = wa.wrongData?.audioUrl || '';
      }

      return result;
    });

    console.log(`[오답노트 목록] ${req.user.id} 사용자의 ${type} 타입 오답 ${wrongAnswers.length}개 조회`);
    
    // SRS 카드 정보 디버깅
    const srsCardCount = data.filter(wa => wa.srsCard).length;
    console.log(`[오답노트 SRS 디버깅] 총 ${data.length}개 중 SRS 카드 정보가 있는 항목: ${srsCardCount}개`);
    if (data.length > 0) {
      console.log(`[오답노트 디버깅] 첫 번째 항목 샘플:`, {
        vocabId: data[0].vocabId,
        itemId: data[0].itemId,
        itemType: data[0].itemType,
        hasSrsCard: !!data[0].srsCard,
        hasVocab: !!data[0].vocab,
        vocabLemma: data[0].vocab?.lemma,
        lemma: data[0].lemma
      });
    }

    return res.json({ data });
  } catch (e) {
    console.error('GET /odat-note/list failed:', e);
    return res.status(500).json({ error: 'Failed to load incorrect answer notes' });
  }
});

/**
 * GET /odat-note/queue
 * 새로운 WrongAnswer 모델 기반 오답 퀴즈 큐
 */
router.get('/queue', async (req, res) => {
  try {
    // 복습 가능한 오답들만 조회
    const { generateWrongAnswerQuiz } = require('../services/wrongAnswerService');
    const wrongAnswerQuiz = await generateWrongAnswerQuiz(req.user.id, 100);
    
    if (wrongAnswerQuiz.length === 0) {
      return res.json({ data: [] });
    }

    // vocabIds 추출
    const vocabIds = wrongAnswerQuiz.map(wa => wa.vocabId);
    const queue = await generateMcqQuizItems(prisma, req.user.id, vocabIds);
    
    // wrongAnswer 정보를 퀴즈에 추가
    const enrichedQueue = queue.map(q => {
      const wrongInfo = wrongAnswerQuiz.find(wa => wa.vocabId === q.vocabId);
      return {
        ...q,
        wrongAnswerId: wrongInfo?.wrongAnswerId,
        attempts: wrongInfo?.attempts,
        wrongAt: wrongInfo?.wrongAt,
        reviewWindowEnd: wrongInfo?.reviewWindowEnd
      };
    });
    
    return res.json({ data: enrichedQueue });
  } catch (e) {
    console.error('GET /odat-note/queue failed:', e);
    return res.status(500).json({ error: 'Failed to create quiz for incorrect notes' });
  }
});

/**
 * GET /odat-note/categories
 * 카테고리별 오답 수량 정보
 */
router.get('/categories', async (req, res) => {
  try {
    const categories = await prisma.$queryRaw`
      SELECT 
        itemType,
        COUNT(*) as totalCount,
        SUM(CASE 
          WHEN isCompleted = false 
            AND reviewWindowStart <= NOW() 
            AND reviewWindowEnd >= NOW() 
          THEN 1 ELSE 0 
        END) as activeCount
      FROM wronganswer 
      WHERE userId = ${req.user.id}
      GROUP BY itemType
      ORDER BY itemType
    `;
    
    const data = {
      vocab: { total: 0, active: 0 },
      grammar: { total: 0, active: 0 },
      reading: { total: 0, active: 0 },
      listening: { total: 0, active: 0 }
    };
    
    categories.forEach(cat => {
      // japanese-reading을 reading 카테고리에 포함, japanese-listening을 listening 카테고리에 포함
      let categoryType = cat.itemType;
      if (cat.itemType === 'japanese-reading') {
        categoryType = 'reading';
      } else if (cat.itemType === 'japanese-listening') {
        categoryType = 'listening';
      }

      if (data[categoryType]) {
        // 기존 값에 누적 (reading과 japanese-reading, listening과 japanese-listening을 합침)
        data[categoryType] = {
          total: data[categoryType].total + Number(cat.totalCount),
          active: data[categoryType].active + Number(cat.activeCount)
        };
      }
    });
    
    return res.json({ data });
  } catch (e) {
    console.error('GET /odat-note/categories failed:', e);
    return res.status(500).json({ error: 'Failed to load category statistics' });
  }
});

/**
 * POST /odat-note/create
 * 오답노트에 새로운 항목 추가 (리딩, 문법, 리스닝 등)
 * body: { itemType, itemId, wrongData } 또는 { type, wrongData }
 */
router.post('/create', async (req, res) => {
  try {
    console.log('[ODAT CREATE] 요청 받음:', JSON.stringify(req.body, null, 2));
    
    // 두 가지 형식 지원: { itemType, itemId } 또는 { type }
    let { itemType, itemId, type, wrongData } = req.body;
    
    // type 필드가 있으면 itemType으로 변환하고 itemId 생성
    if (type && !itemType) {
      itemType = type;
      // wrongData에서 고유 ID 생성 (정수) - 언어별로 구분
      if (type === 'reading' && wrongData?.questionIndex !== undefined) {
        itemId = wrongData.questionIndex + 1000; // 리딩: 1000번대
      } else if (type === 'grammar' && wrongData?.questionIndex !== undefined) {
        // topicId와 questionIndex를 조합한 고유 ID 생성
        const topicHash = wrongData.topicId ? wrongData.topicId.split('').reduce((a, b) => {
          a = ((a << 5) - a) + b.charCodeAt(0);
          return a & a;
        }, 0) : 0;
        const baseId = Math.abs(topicHash) % 1000 + wrongData.questionIndex;

        if (wrongData.language === 'ja') {
          itemId = baseId + 2000; // 일본어 문법: 2000번대
        } else {
          itemId = baseId + 2500; // 영어 문법: 2500번대
        }
      } else if (type === 'listening' && wrongData?.questionId) {
        // listening의 questionId가 이미 숫자라면 그대로 사용
        itemId = parseInt(wrongData.questionId) || (wrongData.questionIndex + 3000);
      } else {
        itemId = Date.now() % 1000000; // 타임스탬프의 마지막 6자리
      }
    }
    
    const finalItemType = itemType;
    const finalItemId = itemId;
    
    console.log('[ODAT CREATE] 최종 정보:', { finalItemType, finalItemId, userId: req.user.id });
    
    if (!finalItemType || !finalItemId) {
      console.log('[ODAT CREATE] 필수 필드 누락');
      return res.status(400).json({ error: 'itemType and itemId are required' });
    }
    
    // 지원되는 타입 체크
    const validTypes = ['vocab', 'grammar', 'reading', 'listening'];
    if (!validTypes.includes(finalItemType)) {
      console.log('[ODAT CREATE] 잘못된 타입:', finalItemType);
      return res.status(400).json({ error: 'Invalid itemType. Must be one of: vocab, grammar, reading, listening' });
    }
    
    // 기존 오답 항목이 있는지 확인
    console.log('[ODAT CREATE] 기존 항목 조회 중...');
    const existingWrongAnswer = await prisma.wronganswer.findFirst({
      where: {
        userId: req.user.id,
        itemType: finalItemType,
        itemId: finalItemId,
        isCompleted: false
      }
    });
    
    console.log('[ODAT CREATE] 기존 항목 조회 결과:', existingWrongAnswer ? '있음' : '없음');
    
    let wrongAnswer;
    
    if (existingWrongAnswer) {
      // 기존 항목이 있으면 카운트 증가
      console.log('[ODAT CREATE] 기존 항목 업데이트 중...');
      wrongAnswer = await prisma.wronganswer.update({
        where: { id: existingWrongAnswer.id },
        data: {
          attempts: existingWrongAnswer.attempts + 1,
          wrongAt: new Date(), // UTC 시간으로 통일
          wrongData: wrongData || existingWrongAnswer.wrongData,
          // vocab 타입인 경우 vocabId 필드도 업데이트 (JOIN을 위해)
          ...(finalItemType === 'vocab' && wrongData?.vocabId && { vocabId: parseInt(wrongData.vocabId) }),
          // 복습 창을 다시 연장 (24시간)
          reviewWindowStart: new Date(),
          reviewWindowEnd: new Date(Date.now() + 24 * 60 * 60 * 1000)
        }
      });
    } else {
      // 새로운 오답 항목 생성
      console.log('[ODAT CREATE] 새로운 항목 생성 중...');
      wrongAnswer = await prisma.wronganswer.create({
        data: {
          userId: req.user.id,
          itemType: finalItemType,
          itemId: finalItemId,
          // vocab 타입인 경우 vocabId 필드도 설정 (JOIN을 위해)
          ...(finalItemType === 'vocab' && wrongData?.vocabId && { vocabId: parseInt(wrongData.vocabId) }),
          attempts: 1,
          wrongAt: new Date(), // UTC 시간으로 통일
          wrongData: wrongData || {},
          isCompleted: false,
          // 24시간 복습 창 설정
          reviewWindowStart: new Date(),
          reviewWindowEnd: new Date(Date.now() + 24 * 60 * 60 * 1000)
        }
      });
    }
    
    console.log('[ODAT CREATE] 최종 결과:', {
      id: wrongAnswer.id,
      attempts: wrongAnswer.attempts,
      message: existingWrongAnswer ? 'Wrong answer count updated' : 'Wrong answer recorded'
    });
    
    return res.json({ 
      data: wrongAnswer,
      message: existingWrongAnswer ? 'Wrong answer count updated' : 'Wrong answer recorded'
    });
  } catch (e) {
    console.error('POST /odat-note/create failed:', e);
    return res.status(500).json({ error: 'Failed to record wrong answer' });
  }
});

/**
 * POST /odat-note/:id/resolve
 * 오답 항목을 완료 처리
 */
router.post('/:id/resolve', async (req, res) => {
  try {
    const wrongAnswerId = parseInt(req.params.id);
    
    if (!wrongAnswerId) {
      return res.status(400).json({ error: 'Valid wrong answer ID required' });
    }
    
    // 해당 오답 항목이 사용자 것인지 확인하고 완료 처리
    const wrongAnswer = await prisma.wronganswer.updateMany({
      where: {
        id: wrongAnswerId,
        userId: req.user.id,
        isCompleted: false
      },
      data: {
        isCompleted: true,
        completedAt: new Date()
      }
    });
    
    if (wrongAnswer.count === 0) {
      return res.status(404).json({ error: 'Wrong answer not found or already completed' });
    }
    
    return res.json({ 
      message: 'Wrong answer resolved successfully',
      data: { resolved: true }
    });
  } catch (e) {
    console.error('POST /odat-note/:id/resolve failed:', e);
    return res.status(500).json({ error: 'Failed to resolve wrong answer' });
  }
});

/**
 * POST /odat-note  
 * 새로운 형식의 오답노트 API (type, wrongData 형식)
 * body: { type, wrongData }
 */
router.post('/', async (req, res) => {
  try {
    console.log(`🔍 [서버 디버그] POST /api/odat-note 요청 받음`);
    console.log(`🔍 [서버 디버그] req.body:`, req.body);
    console.log(`🔍 [서버 디버그] req.user:`, req.user);
    
    const { type, wrongData } = req.body;
    
    if (!type || !wrongData) {
      return res.status(400).json({ error: 'type and wrongData are required' });
    }
    
    // 기존 /create 로직 재사용
    const modifiedReq = {
      ...req,
      body: { type, wrongData }
    };
    
    // /create 엔드포인트의 로직을 직접 호출 (type, wrongData만 사용)
    let finalItemType = type;
    let finalItemId;
    
    // wrongData에서 고유 ID 생성 (정수) - 언어별로 구분
    if (type === 'reading' && wrongData?.questionIndex !== undefined) {
      finalItemId = wrongData.questionIndex + 1000; // 리딩: 1000번대
    } else if (type === 'grammar' && wrongData?.questionIndex !== undefined) {
      // topicId와 questionIndex를 조합한 고유 ID 생성
      const topicHash = wrongData.topicId ? wrongData.topicId.split('').reduce((a, b) => {
        a = ((a << 5) - a) + b.charCodeAt(0);
        return a & a;
      }, 0) : 0;
      const baseId = Math.abs(topicHash) % 1000 + wrongData.questionIndex;

      if (wrongData.language === 'ja') {
        finalItemId = baseId + 2000; // 일본어 문법: 2000번대
      } else {
        finalItemId = baseId + 2500; // 영어 문법: 2500번대
      }
      console.log(`🎌 [문법 오답] topicId: ${wrongData.topicId}, index: ${wrongData.questionIndex}, itemId: ${finalItemId}, language: ${wrongData.language || 'unknown'}`);
    } else if (type === 'listening' && wrongData?.questionId) {
      // listening의 questionId가 문자열이면 해시로 변환
      const questionId = wrongData.questionId;
      if (typeof questionId === 'string') {
        // 문자열 ID를 숫자로 변환 (해시 기반)
        let hash = 0;
        for (let i = 0; i < questionId.length; i++) {
          const char = questionId.charCodeAt(i);
          hash = ((hash << 5) - hash) + char;
          hash = hash & hash; // 32bit로 변환
        }
        finalItemId = Math.abs(hash) + 3000; // 리스닝: 3000번대
      } else {
        finalItemId = parseInt(questionId) + 3000;
      }
    } else {
      finalItemId = Date.now() % 1000000; // 타임스탬프의 마지막 6자리
    }
    
    // 지원되는 타입 체크
    const validTypes = ['vocab', 'grammar', 'reading', 'listening'];
    if (!validTypes.includes(finalItemType)) {
      return res.status(400).json({ error: 'Invalid type. Must be one of: vocab, grammar, reading, listening' });
    }
    
    // 기존 오답 항목이 있는지 확인 (리스닝은 questionId로도 중복 체크)
    let existingWrongAnswer;
    
    if (finalItemType === 'listening' && wrongData?.questionId) {
      // 리스닝의 경우 questionId 기반으로 더 정확한 중복 체크
      const allUserListeningRecords = await prisma.wronganswer.findMany({
        where: {
          userId: req.user.id,
          itemType: 'listening',
          isCompleted: false
        }
      });
      
      existingWrongAnswer = allUserListeningRecords.find(record => 
        record.itemId === finalItemId || 
        (record.wrongData && record.wrongData.questionId === wrongData.questionId)
      );
    } else {
      existingWrongAnswer = await prisma.wronganswer.findFirst({
        where: {
          userId: req.user.id,
          itemType: finalItemType,
          itemId: finalItemId,
          isCompleted: false
        }
      });
    }
    
    let wrongAnswer;
    
    if (existingWrongAnswer) {
      // 기존 항목이 있으면 카운트 증가
      wrongAnswer = await prisma.wronganswer.update({
        where: { id: existingWrongAnswer.id },
        data: {
          attempts: existingWrongAnswer.attempts + 1,
          wrongAt: new Date(), // UTC 시간으로 통일
          wrongData: wrongData || existingWrongAnswer.wrongData,
          reviewWindowStart: new Date(),
          reviewWindowEnd: new Date(Date.now() + 24 * 60 * 60 * 1000)
        }
      });
    } else {
      // 새로운 오답 항목 생성
      wrongAnswer = await prisma.wronganswer.create({
        data: {
          userId: req.user.id,
          itemType: finalItemType,
          itemId: finalItemId,
          attempts: 1,
          wrongAt: new Date(), // UTC 시간으로 통일
          wrongData: wrongData || {},
          isCompleted: false,
          reviewWindowStart: new Date(),
          reviewWindowEnd: new Date(Date.now() + 24 * 60 * 60 * 1000)
        }
      });
    }
    
    return res.json({ 
      data: wrongAnswer,
      message: `Wrong answer recorded for ${finalItemType}` 
    });
    
  } catch (e) {
    console.error('POST /odat-note failed:', e);
    return res.status(500).json({ error: 'Failed to record wrong answer' });
  }
});

module.exports = router;
