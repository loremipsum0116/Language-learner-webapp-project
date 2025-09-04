// routes/test-vocab.js
// Simple test endpoint for vocab data without authentication

const express = require('express');
const { prisma } = require('../lib/prismaClient');
const router = express.Router();

/**
 * GET /test-vocab
 * Simple vocab endpoint for testing - returns limited data
 */
router.get('/', async (req, res) => {
  try {
    const { 
      limit = 20, 
      levelCEFR = 'A1' 
    } = req.query;

    const limitInt = Math.min(parseInt(limit), 100); // Max 100 items

    console.log(`[TEST-VOCAB] Fetching ${limitInt} real vocabs for level ${levelCEFR}`);

    // Get real vocab data from database with simplified query
    const vocabs = await prisma.vocab.findMany({
      where: {
        languageId: 1, // English
        levelCEFR: levelCEFR,
      },
      take: limitInt,
      orderBy: { lemma: 'asc' },
      include: {
        dictentry: {
          select: {
            ipa: true,
            examples: true
          }
        }
      }
    });

    console.log(`[TEST-VOCAB] Found ${vocabs.length} real vocabs`);

    // Transform to simple format to avoid JSON issues
    const simplifiedVocabs = vocabs.map(vocab => {
      let primaryGloss = '';
      
      // Extract Korean gloss safely
      if (vocab.dictentry?.examples && Array.isArray(vocab.dictentry.examples)) {
        const glossExample = vocab.dictentry.examples.find(ex => ex.kind === 'gloss');
        if (glossExample && glossExample.ko) {
          primaryGloss = glossExample.ko.substring(0, 50); // Limit to 50 chars
        }
      }

      return {
        id: vocab.id,
        lemma: vocab.lemma,
        pos: vocab.pos,
        levelCEFR: vocab.levelCEFR,
        ko_gloss: primaryGloss || `뜻: ${vocab.lemma}`, // fallback
        ipa: vocab.dictentry?.ipa || ''
      };
    });

    // Use simple response without middleware to avoid JSON serialization issues
    res.writeHead(200, { 
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
    
    res.end(JSON.stringify({
      success: true,
      count: simplifiedVocabs.length,
      data: simplifiedVocabs
    }));

  } catch (error) {
    console.error('[TEST-VOCAB] Error:', error);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      success: false,
      error: error.message
    }));
  }
});

module.exports = router;