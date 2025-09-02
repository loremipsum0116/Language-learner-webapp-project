// routes/api/mobile/learning.js
const express = require('express');
const router = express.Router();
const { prisma } = require('../../../lib/prismaClient');

// 모바일 최적화된 단어 학습 목록 조회
router.get('/vocab', async (req, res) => {
  try {
    const userId = req.user.id;
    const { 
      level, 
      limit = 50, 
      offset = 0, 
      offline = false,
      categories,
      difficulty 
    } = req.query;

    let where = {};
    
    if (level) {
      where.levelCEFR = level;
    }

    if (categories) {
      const categoryList = categories.split(',');
      where.categories = {
        some: {
          name: { in: categoryList }
        }
      };
    }

    const vocabs = await prisma.vocab.findMany({
      where,
      include: {
        dictentry: {
          select: {
            definition: true,
            examples: true,
            audioLocal: true,
            pronunciation: true
          }
        },
        categories: {
          select: {
            name: true,
            color: true
          }
        },
        userProgress: {
          where: { userId },
          select: {
            isLearned: true,
            difficulty: true,
            lastStudiedAt: true,
            studyCount: true
          }
        }
      },
      orderBy: [
        { frequency: 'desc' },
        { id: 'asc' }
      ],
      take: parseInt(limit),
      skip: parseInt(offset)
    });

    // 모바일 최적화: 불필요한 필드 제거, 데이터 압축
    const optimizedVocabs = vocabs.map(vocab => {
      const userProg = vocab.userProgress[0];
      
      // 오디오 데이터 파싱
      let audioData = null;
      if (vocab.dictentry?.audioLocal) {
        try {
          audioData = JSON.parse(vocab.dictentry.audioLocal);
          // 모바일용으로 오디오 URL만 추출
          if (audioData.url) {
            audioData = { url: audioData.url, duration: audioData.duration };
          }
        } catch (e) {
          console.warn('Failed to parse audio data for', vocab.lemma);
        }
      }

      return {
        id: vocab.id,
        word: vocab.lemma,
        level: vocab.levelCEFR,
        pos: vocab.pos,
        frequency: vocab.frequency,
        definition: vocab.dictentry?.definition || '',
        pronunciation: vocab.dictentry?.pronunciation || '',
        examples: vocab.dictentry?.examples?.slice(0, 2) || [], // 처음 2개 예문만
        audio: audioData,
        categories: vocab.categories.map(cat => ({
          name: cat.name,
          color: cat.color
        })),
        progress: {
          isLearned: userProg?.isLearned || false,
          difficulty: userProg?.difficulty || 'medium',
          lastStudiedAt: userProg?.lastStudiedAt,
          studyCount: userProg?.studyCount || 0
        }
      };
    });

    // 오프라인 모드 지원
    if (offline === 'true') {
      res.set('X-Offline-Cacheable', 'true');
      res.set('Cache-Control', 'public, max-age=86400'); // 24시간 캐시
    }

    res.json({
      vocabs: optimizedVocabs,
      pagination: {
        total: optimizedVocabs.length,
        limit: parseInt(limit),
        offset: parseInt(offset),
        hasMore: optimizedVocabs.length === parseInt(limit)
      }
    });

  } catch (error) {
    console.error('[MOBILE LEARNING] Vocab error:', error);
    res.status(500).json({
      error: 'Failed to get vocabulary'
    });
  }
});

// 배치 단어 학습 상태 업데이트 (모바일 최적화)
router.post('/vocab/batch-update', async (req, res) => {
  try {
    const userId = req.user.id;
    const { updates } = req.body; // [{ vocabId, isLearned, difficulty, studyTime }]

    if (!Array.isArray(updates) || updates.length === 0) {
      return res.status(400).json({
        error: 'Updates array is required'
      });
    }

    if (updates.length > 100) {
      return res.status(400).json({
        error: 'Maximum 100 updates per batch'
      });
    }

    const results = await Promise.allSettled(
      updates.map(async (update) => {
        const { vocabId, isLearned, difficulty, studyTime } = update;
        
        return prisma.userProgress.upsert({
          where: {
            userId_vocabId: {
              userId,
              vocabId: parseInt(vocabId)
            }
          },
          update: {
            isLearned: isLearned || false,
            difficulty: difficulty || 'medium',
            lastStudiedAt: new Date(),
            studyCount: { increment: 1 },
            totalStudyTime: { increment: studyTime || 0 }
          },
          create: {
            userId,
            vocabId: parseInt(vocabId),
            isLearned: isLearned || false,
            difficulty: difficulty || 'medium',
            lastStudiedAt: new Date(),
            studyCount: 1,
            totalStudyTime: studyTime || 0
          }
        });
      })
    );

    const successful = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;

    res.json({
      message: 'Batch update completed',
      successful,
      failed,
      total: updates.length
    });

  } catch (error) {
    console.error('[MOBILE LEARNING] Batch update error:', error);
    res.status(500).json({
      error: 'Batch update failed'
    });
  }
});

// 모바일 최적화된 카테고리 목록
router.get('/categories', async (req, res) => {
  try {
    const categories = await prisma.category.findMany({
      select: {
        id: true,
        name: true,
        color: true,
        description: true,
        _count: {
          select: {
            vocabs: true
          }
        }
      },
      orderBy: {
        name: 'asc'
      }
    });

    const optimizedCategories = categories.map(cat => ({
      id: cat.id,
      name: cat.name,
      color: cat.color,
      description: cat.description,
      vocabCount: cat._count.vocabs
    }));

    // 캐시 설정
    res.set('Cache-Control', 'public, max-age=3600'); // 1시간 캐시

    res.json({
      categories: optimizedCategories
    });

  } catch (error) {
    console.error('[MOBILE LEARNING] Categories error:', error);
    res.status(500).json({
      error: 'Failed to get categories'
    });
  }
});

// 모바일용 레벨별 진도 요약
router.get('/progress-summary', async (req, res) => {
  try {
    const userId = req.user.id;

    const progressByLevel = await prisma.userProgress.groupBy({
      by: ['vocab'],
      where: {
        userId,
        isLearned: true
      },
      _count: {
        _all: true
      }
    });

    // 레벨별 전체 단어 수
    const totalByLevel = await prisma.vocab.groupBy({
      by: ['levelCEFR'],
      _count: {
        _all: true
      }
    });

    const levelStats = totalByLevel.map(level => {
      const learned = progressByLevel.filter(p => 
        p.vocab.levelCEFR === level.levelCEFR
      ).length;
      
      return {
        level: level.levelCEFR,
        total: level._count._all,
        learned,
        percentage: Math.round((learned / level._count._all) * 100)
      };
    });

    // 전체 통계
    const totalLearned = progressByLevel.length;
    const totalWords = totalByLevel.reduce((sum, level) => sum + level._count._all, 0);

    res.json({
      overall: {
        totalWords,
        totalLearned,
        percentage: Math.round((totalLearned / totalWords) * 100)
      },
      byLevel: levelStats
    });

  } catch (error) {
    console.error('[MOBILE LEARNING] Progress summary error:', error);
    res.status(500).json({
      error: 'Failed to get progress summary'
    });
  }
});

// 일일 학습 목표 조회/설정
router.get('/daily-goal', async (req, res) => {
  try {
    const userId = req.user.id;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // 오늘 학습한 단어 수
    const todayProgress = await prisma.userProgress.count({
      where: {
        userId,
        lastStudiedAt: {
          gte: today,
          lt: tomorrow
        }
      }
    });

    // 사용자 설정에서 일일 목표 가져오기
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { preferences: true }
    });

    const dailyGoal = user?.preferences?.dailyGoal || 20;

    res.json({
      dailyGoal,
      todayProgress,
      percentage: Math.min(Math.round((todayProgress / dailyGoal) * 100), 100),
      completed: todayProgress >= dailyGoal
    });

  } catch (error) {
    console.error('[MOBILE LEARNING] Daily goal error:', error);
    res.status(500).json({
      error: 'Failed to get daily goal'
    });
  }
});

router.put('/daily-goal', async (req, res) => {
  try {
    const userId = req.user.id;
    const { goal } = req.body;

    if (!goal || goal < 1 || goal > 200) {
      return res.status(400).json({
        error: 'Goal must be between 1 and 200'
      });
    }

    await prisma.user.update({
      where: { id: userId },
      data: {
        preferences: {
          update: {
            dailyGoal: parseInt(goal)
          }
        }
      }
    });

    res.json({
      message: 'Daily goal updated',
      dailyGoal: parseInt(goal)
    });

  } catch (error) {
    console.error('[MOBILE LEARNING] Update daily goal error:', error);
    res.status(500).json({
      error: 'Failed to update daily goal'
    });
  }
});

// 모바일용 오디오 스트리밍 최적화
router.get('/audio/:vocabId', async (req, res) => {
  try {
    const { vocabId } = req.params;
    const range = req.headers.range;

    const vocab = await prisma.vocab.findUnique({
      where: { id: parseInt(vocabId) },
      include: {
        dictentry: {
          select: {
            audioLocal: true
          }
        }
      }
    });

    if (!vocab || !vocab.dictentry?.audioLocal) {
      return res.status(404).json({
        error: 'Audio not found'
      });
    }

    let audioData;
    try {
      audioData = JSON.parse(vocab.dictentry.audioLocal);
    } catch (e) {
      return res.status(500).json({
        error: 'Invalid audio data'
      });
    }

    if (!audioData.url) {
      return res.status(404).json({
        error: 'Audio file not available'
      });
    }

    // Range 요청 지원 (모바일에서 중요)
    if (range) {
      res.set('Accept-Ranges', 'bytes');
      res.set('Content-Type', 'audio/mpeg');
      
      // 실제 파일 스트리밍은 여기서 구현
      // 현재는 리다이렉트로 처리
      return res.redirect(audioData.url);
    }

    res.json({
      audioUrl: audioData.url,
      duration: audioData.duration,
      bitrate: audioData.bitrate || '64kbps'
    });

  } catch (error) {
    console.error('[MOBILE LEARNING] Audio error:', error);
    res.status(500).json({
      error: 'Failed to get audio'
    });
  }
});

module.exports = router;