// routes/api/mobile/simple-vocab.js
// Simple vocab endpoint for mobile app with limited data to avoid JSON serialization issues

const express = require('express');
const { prisma } = require('../../../lib/prismaClient');
const router = express.Router();

/**
 * GET /api/mobile/vocab/simple
 * Returns simplified vocab data for mobile app
 */
router.get('/simple', async (req, res) => {
  try {
    const { 
      limit = 20, 
      offset = 0, 
      levelCEFR = 'A1',
      search = '' 
    } = req.query;

    const limitInt = Math.min(parseInt(limit), 50); // Max 50 items
    const offsetInt = parseInt(offset) || 0;

    // Build where condition
    const where = {
      languageId: 1, // English
      levelCEFR: levelCEFR,
    };

    if (search) {
      where.lemma = {
        contains: search
      };
    }

    // Get simplified vocab data
    const vocabs = await prisma.vocab.findMany({
      where,
      take: limitInt,
      skip: offsetInt,
      orderBy: { lemma: 'asc' },
      select: {
        id: true,
        lemma: true,
        pos: true,
        levelCEFR: true,
        dictentry: {
          select: {
            ipa: true,
            examples: true,
          }
        }
      }
    });

    // Get total count
    const total = await prisma.vocab.count({ where });

    // Simplify the response to avoid JSON serialization issues
    const simplifiedVocabs = vocabs.map(vocab => {
      let primaryGloss = '';
      let example = '';

      // Extract simple gloss and example from dictentry
      if (vocab.dictentry?.examples && Array.isArray(vocab.dictentry.examples)) {
        const glossExample = vocab.dictentry.examples.find(ex => ex.kind === 'gloss');
        const sentenceExample = vocab.dictentry.examples.find(ex => ex.kind === 'example');
        
        if (glossExample?.ko) {
          primaryGloss = glossExample.ko.substring(0, 100); // Limit length
        }
        if (sentenceExample?.ko) {
          example = sentenceExample.ko.substring(0, 200); // Limit length
        }
      }

      return {
        id: vocab.id,
        lemma: vocab.lemma,
        pos: vocab.pos,
        levelCEFR: vocab.levelCEFR,
        ipa: vocab.dictentry?.ipa || '',
        gloss: primaryGloss,
        example: example,
      };
    });

    res.json({
      success: true,
      data: {
        vocabs: simplifiedVocabs,
        pagination: {
          total,
          limit: limitInt,
          offset: offsetInt,
          hasMore: (offsetInt + limitInt) < total
        }
      }
    });

  } catch (error) {
    console.error('Simple vocab API error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch vocabulary data',
      message: error.message
    });
  }
});

/**
 * GET /api/mobile/vocab/levels
 * Get available CEFR levels with counts
 */
router.get('/levels', async (req, res) => {
  try {
    const levels = await prisma.vocab.groupBy({
      by: ['levelCEFR'],
      where: {
        languageId: 1, // English
      },
      _count: {
        id: true
      },
      orderBy: {
        levelCEFR: 'asc'
      }
    });

    const levelData = levels.map(level => ({
      level: level.levelCEFR,
      count: level._count.id
    }));

    res.json({
      success: true,
      data: levelData
    });

  } catch (error) {
    console.error('Vocab levels API error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch level data'
    });
  }
});

module.exports = router;