// routes/api/mobile/srs.js
const express = require('express');
const router = express.Router();
const { prisma } = require('../../../lib/prismaClient');

// SRS 서비스 임포트
const { 
  getSrsStatus,
  getAvailableCardsForReview,
  getWaitingCardsCount,
  createManualFolder,
  completeFolderAndScheduleNext,
  restartMasteredFolder
} = require('../../../services/srsService');

// 모바일 최적화된 SRS 상태 조회
router.get('/status', async (req, res) => {
  try {
    const userId = req.user.id;
    
    const status = await getSrsStatus(userId);
    
    // 모바일용으로 간소화된 응답
    const mobileStatus = {
      totalCards: status.totalCards,
      availableNow: status.availableNow,
      waiting: status.waiting,
      mastered: status.mastered,
      currentStreak: status.currentStreak || 0,
      nextReviewAt: status.nextReviewAt,
      todayCompleted: status.todayCompleted || 0,
      todayGoal: status.todayGoal || 20
    };

    res.json(mobileStatus);

  } catch (error) {
    console.error('[MOBILE SRS] Status error:', error);
    res.status(500).json({
      error: 'Failed to get SRS status'
    });
  }
});

// 모바일용 배치 카드 조회 (오프라인 지원)
router.get('/cards/batch', async (req, res) => {
  try {
    const userId = req.user.id;
    const { 
      limit = 20, 
      includeWaiting = false,
      offline = false 
    } = req.query;

    // 현재 학습 가능한 카드들
    let availableCards = await getAvailableCardsForReview(userId, parseInt(limit));
    
    // 대기 중인 카드도 포함 (오프라인 모드용)
    if (includeWaiting === 'true' || offline === 'true') {
      const waitingCards = await prisma.srsCard.findMany({
        where: {
          userId,
          status: 'WAITING',
          nextDue: {
            gt: new Date()
          }
        },
        include: {
          vocab: {
            include: {
              dictentry: {
                select: {
                  definition: true,
                  examples: true,
                  audioLocal: true
                }
              }
            }
          }
        },
        take: 10,
        orderBy: {
          nextDue: 'asc'
        }
      });

      availableCards = [...availableCards, ...waitingCards];
    }

    // 모바일용 데이터 최적화
    const optimizedCards = availableCards.map(card => ({
      id: card.id,
      word: card.vocab.lemma,
      level: card.vocab.levelCEFR,
      definition: card.vocab.dictentry?.definition || '',
      examples: card.vocab.dictentry?.examples?.slice(0, 2) || [],
      audio: card.vocab.dictentry?.audioLocal ? 
        JSON.parse(card.vocab.dictentry.audioLocal).url : null,
      srsData: {
        level: card.level,
        status: card.status,
        nextDue: card.nextDue,
        lastStudied: card.lastStudied,
        correctCount: card.correctCount,
        incorrectCount: card.incorrectCount
      }
    }));

    // 오프라인 캐시 설정
    if (offline === 'true') {
      res.set('X-Offline-Cacheable', 'true');
      res.set('Cache-Control', 'private, max-age=1800'); // 30분 캐시
    }

    res.json({
      cards: optimizedCards,
      total: optimizedCards.length,
      availableNow: optimizedCards.filter(c => c.srsData.status === 'AVAILABLE').length,
      waiting: optimizedCards.filter(c => c.srsData.status === 'WAITING').length
    });

  } catch (error) {
    console.error('[MOBILE SRS] Cards batch error:', error);
    res.status(500).json({
      error: 'Failed to get cards'
    });
  }
});

// 모바일 배치 카드 학습 완료 처리
router.post('/cards/batch-complete', async (req, res) => {
  try {
    const userId = req.user.id;
    const { completions } = req.body; 
    // [{ cardId, correct, responseTime, studyTime }]

    if (!Array.isArray(completions) || completions.length === 0) {
      return res.status(400).json({
        error: 'Completions array is required'
      });
    }

    if (completions.length > 50) {
      return res.status(400).json({
        error: 'Maximum 50 completions per batch'
      });
    }

    const results = await Promise.allSettled(
      completions.map(async (completion) => {
        const { cardId, correct, responseTime, studyTime } = completion;
        
        const card = await prisma.srsCard.findFirst({
          where: {
            id: parseInt(cardId),
            userId
          }
        });

        if (!card) {
          throw new Error(`Card ${cardId} not found`);
        }

        // SRS 알고리즘 적용
        const now = new Date();
        let newLevel = card.level;
        let nextDue = card.nextDue;
        let status = card.status;

        if (correct) {
          // 정답 처리
          newLevel = Math.min(card.level + 1, 7); // 최대 레벨 7
          
          // 다음 복습 시간 계산 (간소화된 SRS)
          const intervals = [1, 3, 7, 14, 30, 90, 180]; // 분, 시간, 일
          const units = ['minute', 'hour', 'day', 'day', 'day', 'day', 'day'];
          
          const interval = intervals[Math.min(newLevel - 1, intervals.length - 1)];
          const unit = units[Math.min(newLevel - 1, units.length - 1)];
          
          nextDue = new Date(now.getTime() + (interval * (unit === 'minute' ? 60000 : 
                                                      unit === 'hour' ? 3600000 : 86400000)));
          status = newLevel >= 7 ? 'MASTERED' : 'WAITING';
        } else {
          // 오답 처리
          newLevel = Math.max(1, card.level - 1);
          nextDue = new Date(now.getTime() + 300000); // 5분 후
          status = 'AVAILABLE';
        }

        return prisma.srsCard.update({
          where: { id: parseInt(cardId) },
          data: {
            level: newLevel,
            status,
            nextDue,
            lastStudied: now,
            correctCount: correct ? { increment: 1 } : undefined,
            incorrectCount: correct ? undefined : { increment: 1 },
            totalResponseTime: { increment: responseTime || 0 },
            totalStudyTime: { increment: studyTime || 0 },
            studyCount: { increment: 1 }
          }
        });
      })
    );

    const successful = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;

    // 학습 통계 업데이트
    if (successful > 0) {
      await prisma.userDailyStats.upsert({
        where: {
          userId_date: {
            userId,
            date: new Date().toISOString().split('T')[0]
          }
        },
        update: {
          cardsCompleted: { increment: successful },
          studyTime: { increment: completions.reduce((sum, c) => sum + (c.studyTime || 0), 0) }
        },
        create: {
          userId,
          date: new Date().toISOString().split('T')[0],
          cardsCompleted: successful,
          studyTime: completions.reduce((sum, c) => sum + (c.studyTime || 0), 0)
        }
      });
    }

    res.json({
      message: 'Batch completion processed',
      successful,
      failed,
      total: completions.length,
      cardsCompleted: successful
    });

  } catch (error) {
    console.error('[MOBILE SRS] Batch complete error:', error);
    res.status(500).json({
      error: 'Batch completion failed'
    });
  }
});

// 모바일용 폴더 생성 (배치)
router.post('/folders/batch-create', async (req, res) => {
  try {
    const userId = req.user.id;
    const { folders } = req.body;
    // [{ name, vocabIds, settings }]

    if (!Array.isArray(folders) || folders.length === 0) {
      return res.status(400).json({
        error: 'Folders array is required'
      });
    }

    if (folders.length > 10) {
      return res.status(400).json({
        error: 'Maximum 10 folders per batch'
      });
    }

    const results = await Promise.allSettled(
      folders.map(async (folderData) => {
        const { name, vocabIds, settings } = folderData;
        
        return createManualFolder(userId, {
          name,
          vocabIds: vocabIds || [],
          settings: {
            initialInterval: settings?.initialInterval || 1,
            maxCardsPerSession: settings?.maxCardsPerSession || 20,
            ...settings
          }
        });
      })
    );

    const successful = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;
    const createdFolders = results
      .filter(r => r.status === 'fulfilled')
      .map(r => r.value);

    res.json({
      message: 'Batch folder creation completed',
      successful,
      failed,
      total: folders.length,
      folders: createdFolders
    });

  } catch (error) {
    console.error('[MOBILE SRS] Batch folder create error:', error);
    res.status(500).json({
      error: 'Batch folder creation failed'
    });
  }
});

// 모바일용 학습 통계 조회
router.get('/stats/summary', async (req, res) => {
  try {
    const userId = req.user.id;
    const { days = 7 } = req.query;

    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));

    const stats = await prisma.userDailyStats.findMany({
      where: {
        userId,
        date: {
          gte: startDate.toISOString().split('T')[0],
          lte: endDate.toISOString().split('T')[0]
        }
      },
      orderBy: {
        date: 'desc'
      }
    });

    const totalCards = stats.reduce((sum, day) => sum + (day.cardsCompleted || 0), 0);
    const totalTime = stats.reduce((sum, day) => sum + (day.studyTime || 0), 0);
    const avgCardsPerDay = Math.round(totalCards / Math.max(stats.length, 1));

    res.json({
      period: {
        days: parseInt(days),
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0]
      },
      summary: {
        totalCards,
        totalTime,
        avgCardsPerDay,
        studyDays: stats.length
      },
      dailyStats: stats.map(stat => ({
        date: stat.date,
        cards: stat.cardsCompleted || 0,
        time: stat.studyTime || 0
      }))
    });

  } catch (error) {
    console.error('[MOBILE SRS] Stats summary error:', error);
    res.status(500).json({
      error: 'Failed to get stats summary'
    });
  }
});

// 오프라인 동기화를 위한 변경사항 조회
router.get('/changes/since', async (req, res) => {
  try {
    const userId = req.user.id;
    const { timestamp } = req.query;

    if (!timestamp) {
      return res.status(400).json({
        error: 'Timestamp parameter is required'
      });
    }

    const since = new Date(timestamp);

    const changes = await prisma.srsCard.findMany({
      where: {
        userId,
        OR: [
          { updatedAt: { gt: since } },
          { createdAt: { gt: since } }
        ]
      },
      include: {
        vocab: {
          select: {
            lemma: true,
            levelCEFR: true
          }
        }
      },
      orderBy: {
        updatedAt: 'desc'
      }
    });

    res.json({
      changes: changes.map(card => ({
        id: card.id,
        word: card.vocab.lemma,
        level: card.vocab.levelCEFR,
        srsLevel: card.level,
        status: card.status,
        nextDue: card.nextDue,
        lastModified: card.updatedAt,
        action: card.createdAt > since ? 'created' : 'updated'
      })),
      total: changes.length,
      syncTime: new Date().toISOString()
    });

  } catch (error) {
    console.error('[MOBILE SRS] Changes since error:', error);
    res.status(500).json({
      error: 'Failed to get changes'
    });
  }
});

module.exports = router;