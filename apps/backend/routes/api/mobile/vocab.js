/**
 * Mobile Vocabulary API
 * Optimized for mobile clients with pagination and compression
 */

const express = require('express');
const router = express.Router();
const { prisma } = require('../../../lib/prismaClient');
const ResponseFormatter = require('../../../utils/responseFormatter');
const authenticateToken = require('../../../middleware/auth');
const zlib = require('zlib');
const { promisify } = require('util');
const gzip = promisify(zlib.gzip);

/**
 * GET /api/mobile/vocab/paginated
 * Paginated vocabulary list optimized for mobile
 * 
 * Query parameters:
 * - page: Page number (default: 1)
 * - limit: Items per page (default: 20, max: 50)
 * - level: Filter by CEFR level (A1, A2, B1, B2, C1, C2)
 * - category: Filter by exam category
 * - search: Search term for word/meaning
 * - cursor: Cursor for cursor-based pagination (optional)
 * - compress: Enable gzip compression (default: true)
 */
router.get('/paginated', authenticateToken, async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 20, 
      level, 
      category, 
      search,
      cursor,
      compress = 'true'
    } = req.query;
    
    const userId = req.user.id;
    
    // Validate and sanitize inputs
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(50, Math.max(1, parseInt(limit)));
    const enableCompression = compress === 'true';
    
    // Build where clause
    const where = {};
    
    if (level) {
      where.level = level.toUpperCase();
    }
    
    if (category) {
      where.examCategories = {
        some: {
          name: category
        }
      };
    }
    
    if (search) {
      where.OR = [
        { lemma: { contains: search, mode: 'insensitive' } },
        { dictentry: { gloss: { contains: search, mode: 'insensitive' } } }
      ];
    }
    
    // Cursor-based pagination for better performance
    let queryOptions = {
      where,
      take: limitNum,
      select: {
        id: true,
        lemma: true,
        level: true,
        pos: true,
        source: true,
        dictentry: {
          select: {
            id: true,
            gloss: true,
            koGloss: true,
            examples: {
              select: {
                id: true,
                example: true,
                translation: true,
                kind: true
              },
              take: 2 // Limit examples for mobile
            }
          }
        },
        userVocabs: {
          where: { userId },
          select: {
            id: true,
            learningLevel: true,
            reviewCount: true,
            lastReviewedAt: true,
            nextReviewAt: true,
            isLearned: true
          }
        },
        examCategories: {
          select: {
            id: true,
            name: true
          }
        },
        audioUrl: true
      },
      orderBy: [
        { level: 'asc' },
        { lemma: 'asc' }
      ]
    };
    
    // Use cursor if provided (more efficient for mobile)
    if (cursor) {
      queryOptions.cursor = { id: parseInt(cursor) };
      queryOptions.skip = 1; // Skip the cursor item
    } else {
      // Traditional pagination fallback
      queryOptions.skip = (pageNum - 1) * limitNum;
    }
    
    // Execute queries in parallel
    const [vocabs, totalCount] = await Promise.all([
      prisma.vocab.findMany(queryOptions),
      prisma.vocab.count({ where })
    ]);
    
    // Transform data for mobile optimization
    const mobileVocabs = vocabs.map(vocab => ({
      id: vocab.id,
      word: vocab.lemma,
      level: vocab.level,
      pos: vocab.pos,
      meaning: vocab.dictentry?.koGloss || vocab.dictentry?.gloss || '',
      examples: vocab.dictentry?.examples?.map(ex => ({
        text: ex.example,
        translation: ex.translation
      })) || [],
      userProgress: vocab.userVocabs?.[0] ? {
        level: vocab.userVocabs[0].learningLevel,
        reviews: vocab.userVocabs[0].reviewCount,
        nextReview: vocab.userVocabs[0].nextReviewAt,
        learned: vocab.userVocabs[0].isLearned
      } : null,
      categories: vocab.examCategories?.map(cat => cat.name) || [],
      hasAudio: !!vocab.audioUrl
    }));
    
    // Prepare response
    const responseData = {
      items: mobileVocabs,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: totalCount,
        totalPages: Math.ceil(totalCount / limitNum),
        hasNext: cursor ? 
          mobileVocabs.length === limitNum : 
          pageNum < Math.ceil(totalCount / limitNum),
        hasPrev: pageNum > 1,
        nextCursor: mobileVocabs.length > 0 ? 
          mobileVocabs[mobileVocabs.length - 1].id : null
      }
    };
    
    // Apply compression if requested
    if (enableCompression && req.headers['accept-encoding']?.includes('gzip')) {
      const compressed = await gzip(JSON.stringify(responseData));
      res.setHeader('Content-Encoding', 'gzip');
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('X-Compressed', 'true');
      
      // Send compressed response with standard format
      const compressedResponse = ResponseFormatter.success(
        responseData,
        {
          compressed: true,
          originalSize: JSON.stringify(responseData).length,
          compressedSize: compressed.length,
          compressionRatio: (1 - compressed.length / JSON.stringify(responseData).length) * 100
        }
      );
      
      return res.send(compressed);
    }
    
    // Send uncompressed response
    res.paginated(
      mobileVocabs,
      pageNum,
      limitNum,
      totalCount,
      {
        cursor: responseData.pagination.nextCursor,
        compressed: false
      }
    );
    
  } catch (error) {
    console.error('Mobile vocab paginated error:', error);
    res.serverError('Failed to fetch vocabulary data');
  }
});

/**
 * GET /api/mobile/vocab/batch
 * Batch fetch vocabulary by IDs (for offline sync)
 */
router.post('/batch', authenticateToken, async (req, res) => {
  try {
    const { ids, compress = true } = req.body;
    const userId = req.user.id;
    
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.validationError([
        { field: 'ids', message: 'IDs array is required' }
      ]);
    }
    
    // Limit batch size for mobile
    const limitedIds = ids.slice(0, 100);
    
    const vocabs = await prisma.vocab.findMany({
      where: {
        id: { in: limitedIds }
      },
      select: {
        id: true,
        lemma: true,
        level: true,
        pos: true,
        dictentry: {
          select: {
            gloss: true,
            koGloss: true,
            examples: {
              take: 2
            }
          }
        },
        userVocabs: {
          where: { userId },
          select: {
            learningLevel: true,
            nextReviewAt: true,
            isLearned: true
          }
        },
        audioUrl: true
      }
    });
    
    const mobileVocabs = vocabs.map(vocab => ({
      id: vocab.id,
      word: vocab.lemma,
      level: vocab.level,
      meaning: vocab.dictentry?.koGloss || vocab.dictentry?.gloss || '',
      examples: vocab.dictentry?.examples?.slice(0, 2) || [],
      progress: vocab.userVocabs?.[0] || null,
      hasAudio: !!vocab.audioUrl
    }));
    
    res.success(mobileVocabs, {
      count: mobileVocabs.length,
      requestedCount: limitedIds.length
    });
    
  } catch (error) {
    console.error('Mobile vocab batch error:', error);
    res.serverError('Failed to fetch vocabulary batch');
  }
});

/**
 * GET /api/mobile/vocab/search
 * Fast search endpoint for mobile
 */
router.get('/search', authenticateToken, async (req, res) => {
  try {
    const { q, limit = 10 } = req.query;
    
    if (!q || q.length < 2) {
      return res.validationError([
        { field: 'q', message: 'Search query must be at least 2 characters' }
      ]);
    }
    
    const vocabs = await prisma.vocab.findMany({
      where: {
        OR: [
          { lemma: { startsWith: q, mode: 'insensitive' } },
          { lemma: { contains: q, mode: 'insensitive' } }
        ]
      },
      select: {
        id: true,
        lemma: true,
        level: true,
        dictentry: {
          select: {
            gloss: true,
            koGloss: true
          }
        }
      },
      take: Math.min(20, parseInt(limit)),
      orderBy: [
        { lemma: 'asc' }
      ]
    });
    
    const suggestions = vocabs.map(v => ({
      id: v.id,
      word: v.lemma,
      level: v.level,
      meaning: v.dictentry?.koGloss || v.dictentry?.gloss || ''
    }));
    
    res.success(suggestions, {
      query: q,
      count: suggestions.length
    });
    
  } catch (error) {
    console.error('Mobile vocab search error:', error);
    res.serverError('Search failed');
  }
});

module.exports = router;