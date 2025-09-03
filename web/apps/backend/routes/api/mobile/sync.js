// routes/api/mobile/sync.js
const express = require('express');
const router = express.Router();
const { prisma } = require('../../../lib/prismaClient');

// 모바일 오프라인 동기화 서비스
class MobileSyncService {
  
  // 전체 데이터 동기화 상태 확인
  static async getSyncStatus(userId) {
    const [vocabCount, srsCardCount, progressCount, lastSyncAt] = await Promise.all([
      prisma.vocab.count(),
      prisma.srsCard.count({ where: { userId } }),
      prisma.userProgress.count({ where: { userId } }),
      prisma.userSyncLog.findFirst({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true }
      })
    ]);

    return {
      totalVocabs: vocabCount,
      totalSrsCards: srsCardCount,
      totalProgress: progressCount,
      lastSyncAt: lastSyncAt?.createdAt || null,
      serverTime: new Date().toISOString()
    };
  }

  // 증분 동기화 - 변경된 데이터만 가져오기
  static async getIncrementalChanges(userId, lastSyncTime) {
    const since = new Date(lastSyncTime);
    
    const [vocabChanges, srsChanges, progressChanges, deletedItems] = await Promise.all([
      // 새로운/수정된 단어들
      prisma.vocab.findMany({
        where: {
          OR: [
            { createdAt: { gt: since } },
            { updatedAt: { gt: since } }
          ]
        },
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
          }
        },
        orderBy: { updatedAt: 'desc' }
      }),
      
      // SRS 카드 변경사항
      prisma.srsCard.findMany({
        where: {
          userId,
          OR: [
            { createdAt: { gt: since } },
            { updatedAt: { gt: since } }
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
        orderBy: { updatedAt: 'desc' }
      }),
      
      // 학습 진도 변경사항
      prisma.userProgress.findMany({
        where: {
          userId,
          OR: [
            { createdAt: { gt: since } },
            { updatedAt: { gt: since } }
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
        orderBy: { updatedAt: 'desc' }
      }),

      // 삭제된 항목들 (soft delete 가정)
      prisma.deletedItem.findMany({
        where: {
          userId,
          deletedAt: { gt: since }
        },
        orderBy: { deletedAt: 'desc' }
      })
    ]);

    return {
      vocabs: vocabChanges.map(vocab => ({
        id: vocab.id,
        word: vocab.lemma,
        level: vocab.levelCEFR,
        pos: vocab.pos,
        frequency: vocab.frequency,
        definition: vocab.dictentry?.definition || '',
        pronunciation: vocab.dictentry?.pronunciation || '',
        examples: vocab.dictentry?.examples?.slice(0, 3) || [],
        audio: vocab.dictentry?.audioLocal ? 
          JSON.parse(vocab.dictentry.audioLocal) : null,
        categories: vocab.categories,
        action: vocab.createdAt > since ? 'created' : 'updated',
        lastModified: vocab.updatedAt
      })),
      
      srsCards: srsChanges.map(card => ({
        id: card.id,
        vocabId: card.vocabId,
        word: card.vocab.lemma,
        level: card.level,
        status: card.status,
        nextDue: card.nextDue,
        lastStudied: card.lastStudied,
        correctCount: card.correctCount,
        incorrectCount: card.incorrectCount,
        action: card.createdAt > since ? 'created' : 'updated',
        lastModified: card.updatedAt
      })),
      
      progress: progressChanges.map(prog => ({
        id: prog.id,
        vocabId: prog.vocabId,
        word: prog.vocab.lemma,
        isLearned: prog.isLearned,
        difficulty: prog.difficulty,
        lastStudiedAt: prog.lastStudiedAt,
        studyCount: prog.studyCount,
        totalStudyTime: prog.totalStudyTime,
        action: prog.createdAt > since ? 'created' : 'updated',
        lastModified: prog.updatedAt
      })),

      deletedItems: deletedItems.map(item => ({
        id: item.itemId,
        type: item.itemType, // 'vocab', 'srsCard', 'progress'
        deletedAt: item.deletedAt
      })),

      syncTime: new Date().toISOString(),
      hasMore: false // 배치 처리 시 true로 설정
    };
  }

  // 클라이언트에서 서버로 데이터 업로드
  static async uploadChanges(userId, changes) {
    const { srsCompletions, progressUpdates, newFolders } = changes;
    const results = {
      processed: 0,
      errors: []
    };

    // SRS 완료 데이터 처리
    if (srsCompletions && Array.isArray(srsCompletions)) {
      for (const completion of srsCompletions) {
        try {
          await prisma.srsCard.update({
            where: { 
              id: completion.cardId,
              userId 
            },
            data: {
              level: completion.newLevel,
              status: completion.status,
              nextDue: new Date(completion.nextDue),
              lastStudied: new Date(completion.studiedAt),
              correctCount: completion.correctCount,
              incorrectCount: completion.incorrectCount,
              studyCount: { increment: 1 }
            }
          });
          results.processed++;
        } catch (error) {
          results.errors.push({
            type: 'srsCompletion',
            id: completion.cardId,
            error: error.message
          });
        }
      }
    }

    // 학습 진도 업데이트
    if (progressUpdates && Array.isArray(progressUpdates)) {
      for (const update of progressUpdates) {
        try {
          await prisma.userProgress.upsert({
            where: {
              userId_vocabId: {
                userId,
                vocabId: update.vocabId
              }
            },
            update: {
              isLearned: update.isLearned,
              difficulty: update.difficulty,
              lastStudiedAt: new Date(update.lastStudiedAt),
              studyCount: update.studyCount,
              totalStudyTime: update.totalStudyTime
            },
            create: {
              userId,
              vocabId: update.vocabId,
              isLearned: update.isLearned,
              difficulty: update.difficulty,
              lastStudiedAt: new Date(update.lastStudiedAt),
              studyCount: update.studyCount || 1,
              totalStudyTime: update.totalStudyTime || 0
            }
          });
          results.processed++;
        } catch (error) {
          results.errors.push({
            type: 'progressUpdate',
            id: update.vocabId,
            error: error.message
          });
        }
      }
    }

    // 새 폴더 생성
    if (newFolders && Array.isArray(newFolders)) {
      const { createManualFolder } = require('../../../services/srsService');
      
      for (const folder of newFolders) {
        try {
          await createManualFolder(userId, {
            name: folder.name,
            vocabIds: folder.vocabIds,
            settings: folder.settings
          });
          results.processed++;
        } catch (error) {
          results.errors.push({
            type: 'newFolder',
            name: folder.name,
            error: error.message
          });
        }
      }
    }

    return results;
  }
}

// 동기화 상태 조회
router.get('/status', async (req, res) => {
  try {
    const userId = req.user.id;
    const status = await MobileSyncService.getSyncStatus(userId);
    res.json(status);
  } catch (error) {
    console.error('[MOBILE SYNC] Status error:', error);
    res.status(500).json({
      error: 'Failed to get sync status'
    });
  }
});

// 증분 동기화 - 변경사항 다운로드
router.get('/download', async (req, res) => {
  try {
    const userId = req.user.id;
    const { lastSync, batchSize = 100 } = req.query;

    if (!lastSync) {
      return res.status(400).json({
        error: 'lastSync timestamp is required'
      });
    }

    const changes = await MobileSyncService.getIncrementalChanges(userId, lastSync);
    
    // 배치 크기 제한
    const limit = parseInt(batchSize);
    if (changes.vocabs.length > limit) {
      changes.vocabs = changes.vocabs.slice(0, limit);
      changes.hasMore = true;
    }

    // 동기화 로그 기록
    await prisma.userSyncLog.create({
      data: {
        userId,
        syncType: 'download',
        itemCount: changes.vocabs.length + changes.srsCards.length + changes.progress.length,
        status: 'success'
      }
    });

    res.json(changes);

  } catch (error) {
    console.error('[MOBILE SYNC] Download error:', error);
    
    // 에러 로그 기록
    await prisma.userSyncLog.create({
      data: {
        userId: req.user.id,
        syncType: 'download',
        status: 'error',
        errorMessage: error.message
      }
    });

    res.status(500).json({
      error: 'Failed to download sync data'
    });
  }
});

// 증분 동기화 - 변경사항 업로드
router.post('/upload', async (req, res) => {
  try {
    const userId = req.user.id;
    const { changes, clientTime } = req.body;

    if (!changes) {
      return res.status(400).json({
        error: 'Changes data is required'
      });
    }

    const results = await MobileSyncService.uploadChanges(userId, changes);

    // 동기화 로그 기록
    await prisma.userSyncLog.create({
      data: {
        userId,
        syncType: 'upload',
        itemCount: results.processed,
        status: results.errors.length === 0 ? 'success' : 'partial_success',
        errorMessage: results.errors.length > 0 ? 
          JSON.stringify(results.errors.slice(0, 5)) : null
      }
    });

    res.json({
      message: 'Upload completed',
      processed: results.processed,
      errors: results.errors,
      serverTime: new Date().toISOString()
    });

  } catch (error) {
    console.error('[MOBILE SYNC] Upload error:', error);
    
    // 에러 로그 기록
    await prisma.userSyncLog.create({
      data: {
        userId: req.user.id,
        syncType: 'upload',
        status: 'error',
        errorMessage: error.message
      }
    });

    res.status(500).json({
      error: 'Failed to upload sync data'
    });
  }
});

// 전체 동기화 (초기 설치 시)
router.get('/full', async (req, res) => {
  try {
    const userId = req.user.id;
    const { 
      offset = 0, 
      limit = 200,
      includeAudio = false 
    } = req.query;

    const [vocabs, srsCards, progress] = await Promise.all([
      prisma.vocab.findMany({
        include: {
          dictentry: {
            select: {
              definition: true,
              examples: true,
              audioLocal: includeAudio === 'true' ? true : false,
              pronunciation: true
            }
          },
          categories: {
            select: {
              name: true,
              color: true
            }
          }
        },
        orderBy: [
          { frequency: 'desc' },
          { levelCEFR: 'asc' }
        ],
        take: parseInt(limit),
        skip: parseInt(offset)
      }),

      prisma.srsCard.findMany({
        where: { userId },
        include: {
          vocab: {
            select: {
              lemma: true,
              levelCEFR: true
            }
          }
        }
      }),

      prisma.userProgress.findMany({
        where: { userId },
        include: {
          vocab: {
            select: {
              lemma: true,
              levelCEFR: true
            }
          }
        }
      })
    ]);

    const response = {
      vocabs: vocabs.map(vocab => ({
        id: vocab.id,
        word: vocab.lemma,
        level: vocab.levelCEFR,
        pos: vocab.pos,
        frequency: vocab.frequency,
        definition: vocab.dictentry?.definition || '',
        pronunciation: vocab.dictentry?.pronunciation || '',
        examples: vocab.dictentry?.examples?.slice(0, 2) || [],
        categories: vocab.categories,
        ...(includeAudio === 'true' && vocab.dictentry?.audioLocal && {
          audio: JSON.parse(vocab.dictentry.audioLocal)
        })
      })),
      
      srsCards: srsCards.map(card => ({
        id: card.id,
        vocabId: card.vocabId,
        word: card.vocab.lemma,
        level: card.level,
        status: card.status,
        nextDue: card.nextDue,
        lastStudied: card.lastStudied,
        correctCount: card.correctCount,
        incorrectCount: card.incorrectCount
      })),
      
      progress: progress.map(prog => ({
        vocabId: prog.vocabId,
        word: prog.vocab.lemma,
        isLearned: prog.isLearned,
        difficulty: prog.difficulty,
        lastStudiedAt: prog.lastStudiedAt,
        studyCount: prog.studyCount,
        totalStudyTime: prog.totalStudyTime
      })),

      pagination: {
        offset: parseInt(offset),
        limit: parseInt(limit),
        total: vocabs.length,
        hasMore: vocabs.length === parseInt(limit)
      },

      syncTime: new Date().toISOString()
    };

    // 캐시 헤더 설정
    res.set('Cache-Control', 'private, max-age=3600'); // 1시간 캐시

    res.json(response);

  } catch (error) {
    console.error('[MOBILE SYNC] Full sync error:', error);
    res.status(500).json({
      error: 'Failed to perform full sync'
    });
  }
});

// 동기화 히스토리 조회
router.get('/history', async (req, res) => {
  try {
    const userId = req.user.id;
    const { limit = 10 } = req.query;

    const history = await prisma.userSyncLog.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: parseInt(limit),
      select: {
        id: true,
        syncType: true,
        itemCount: true,
        status: true,
        errorMessage: true,
        createdAt: true
      }
    });

    res.json({
      history: history.map(log => ({
        id: log.id,
        type: log.syncType,
        itemCount: log.itemCount || 0,
        status: log.status,
        error: log.errorMessage,
        timestamp: log.createdAt
      }))
    });

  } catch (error) {
    console.error('[MOBILE SYNC] History error:', error);
    res.status(500).json({
      error: 'Failed to get sync history'
    });
  }
});

// 충돌 해결
router.post('/resolve-conflicts', async (req, res) => {
  try {
    const userId = req.user.id;
    const { conflicts } = req.body;
    // [{ type, id, resolution: 'server'|'client', clientData }]

    const resolved = [];
    const errors = [];

    for (const conflict of conflicts) {
      try {
        if (conflict.resolution === 'client' && conflict.clientData) {
          // 클라이언트 데이터로 덮어쓰기
          if (conflict.type === 'srsCard') {
            await prisma.srsCard.update({
              where: { 
                id: conflict.id,
                userId 
              },
              data: conflict.clientData
            });
          } else if (conflict.type === 'progress') {
            await prisma.userProgress.update({
              where: {
                userId_vocabId: {
                  userId,
                  vocabId: conflict.id
                }
              },
              data: conflict.clientData
            });
          }
        }
        // resolution === 'server'인 경우 서버 데이터 유지 (아무 작업 안 함)
        
        resolved.push(conflict.id);
      } catch (error) {
        errors.push({
          id: conflict.id,
          error: error.message
        });
      }
    }

    res.json({
      message: 'Conflicts resolved',
      resolved: resolved.length,
      errors: errors.length,
      details: errors.length > 0 ? errors : undefined
    });

  } catch (error) {
    console.error('[MOBILE SYNC] Resolve conflicts error:', error);
    res.status(500).json({
      error: 'Failed to resolve conflicts'
    });
  }
});

module.exports = router;