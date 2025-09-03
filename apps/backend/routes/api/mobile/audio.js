/**
 * Mobile Audio API
 * Provides compressed audio streaming for mobile clients
 */

const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs').promises;
const fsSync = require('fs');
const ffmpeg = require('fluent-ffmpeg');
const { promisify } = require('util');
const zlib = require('zlib');
const ResponseFormatter = require('../../../utils/responseFormatter');
const authenticateToken = require('../../../middleware/auth');
const crypto = require('crypto');
const { prisma } = require('../../../lib/prismaClient');

// Cache directory for compressed audio
const CACHE_DIR = path.join(__dirname, '../../../cache/audio');
const SUPPORTED_FORMATS = ['mp3', 'ogg', 'webm', 'm4a'];

// Ensure cache directory exists
(async () => {
  try {
    await fs.mkdir(CACHE_DIR, { recursive: true });
  } catch (error) {
    console.error('Failed to create audio cache directory:', error);
  }
})();

/**
 * Helper function to get cache key for audio file
 */
function getCacheKey(filePath, bitrate, format) {
  return crypto
    .createHash('md5')
    .update(`${filePath}-${bitrate}-${format}`)
    .digest('hex');
}

/**
 * Helper function to compress audio file
 */
async function compressAudio(inputPath, outputPath, bitrate = 64) {
  return new Promise((resolve, reject) => {
    // Check if ffmpeg is available
    ffmpeg.getAvailableFormats((err, formats) => {
      if (err) {
        console.error('ffmpeg not available, serving original file');
        return reject(new Error('Audio compression not available'));
      }
      
      ffmpeg(inputPath)
        .audioBitrate(bitrate)
        .audioCodec('libmp3lame')
        .format('mp3')
        .on('end', () => resolve(outputPath))
        .on('error', (err) => reject(err))
        .save(outputPath);
    });
  });
}

/**
 * GET /api/mobile/audio/compressed/:vocabId
 * Stream compressed audio for a vocabulary item
 * 
 * Query parameters:
 * - bitrate: Audio bitrate in kbps (32, 64, 96, 128) - default: 64
 * - format: Audio format (mp3, ogg, webm) - default: mp3
 */
router.get('/compressed/:vocabId', authenticateToken, async (req, res) => {
  try {
    const { vocabId } = req.params;
    const { bitrate = 64, format = 'mp3' } = req.query;
    
    // Validate parameters
    const validBitrates = [32, 64, 96, 128];
    const selectedBitrate = validBitrates.includes(parseInt(bitrate)) 
      ? parseInt(bitrate) 
      : 64;
    
    const selectedFormat = SUPPORTED_FORMATS.includes(format) 
      ? format 
      : 'mp3';
    
    // Get vocabulary item with audio URL
    const vocab = await prisma.vocab.findUnique({
      where: { id: parseInt(vocabId) },
      select: { 
        id: true,
        lemma: true,
        audioUrl: true,
        level: true
      }
    });
    
    if (!vocab) {
      return res.notFound('Vocabulary item');
    }
    
    if (!vocab.audioUrl) {
      return res.notFound('Audio file');
    }
    
    // Construct file path based on audioUrl pattern
    // Expected patterns: /A1/audio/word.mp3, /elementary/word.mp3, etc.
    const audioPath = path.join(__dirname, '../../../', vocab.audioUrl);
    
    // Check if original file exists
    try {
      await fs.access(audioPath);
    } catch (error) {
      // Try alternative paths
      const alternativePaths = [
        path.join(__dirname, '../../../', vocab.level, 'audio', `${vocab.lemma}.mp3`),
        path.join(__dirname, '../../../audio', vocab.level, `${vocab.lemma}.mp3`),
        path.join(__dirname, '../../../public', vocab.audioUrl)
      ];
      
      let foundPath = null;
      for (const altPath of alternativePaths) {
        try {
          await fs.access(altPath);
          foundPath = altPath;
          break;
        } catch (e) {
          continue;
        }
      }
      
      if (!foundPath) {
        return res.notFound('Audio file');
      }
      
      // Use the found path
      audioPath = foundPath;
    }
    
    // Generate cache key
    const cacheKey = getCacheKey(audioPath, selectedBitrate, selectedFormat);
    const cachedFilePath = path.join(CACHE_DIR, `${cacheKey}.${selectedFormat}`);
    
    // Check if compressed version exists in cache
    let compressedPath = cachedFilePath;
    try {
      await fs.access(cachedFilePath);
    } catch (error) {
      // Compressed version doesn't exist, create it
      try {
        if (selectedFormat === 'mp3' && selectedBitrate !== 128) {
          // Compress the audio file
          await compressAudio(audioPath, cachedFilePath, selectedBitrate);
        } else {
          // For now, just copy the original file if format conversion is needed
          // In production, you'd use ffmpeg to convert formats
          await fs.copyFile(audioPath, cachedFilePath);
        }
      } catch (compressionError) {
        console.error('Audio compression failed:', compressionError);
        // Fall back to original file
        compressedPath = audioPath;
      }
    }
    
    // Get file stats
    const stats = await fs.stat(compressedPath);
    const fileSize = stats.size;
    
    // Handle range requests for streaming
    const range = req.headers.range;
    if (range) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunkSize = end - start + 1;
      
      const stream = fsSync.createReadStream(compressedPath, { start, end });
      
      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunkSize,
        'Content-Type': `audio/${selectedFormat}`,
        'Cache-Control': 'public, max-age=3600',
        'X-Compressed-Bitrate': selectedBitrate,
        'X-Audio-Format': selectedFormat
      });
      
      stream.pipe(res);
    } else {
      // No range request, send entire file
      res.writeHead(200, {
        'Content-Length': fileSize,
        'Content-Type': `audio/${selectedFormat}`,
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'public, max-age=3600',
        'X-Compressed-Bitrate': selectedBitrate,
        'X-Audio-Format': selectedFormat
      });
      
      const stream = fsSync.createReadStream(compressedPath);
      stream.pipe(res);
    }
    
  } catch (error) {
    console.error('Mobile audio compressed error:', error);
    res.serverError('Failed to stream audio');
  }
});

/**
 * POST /api/mobile/audio/batch-urls
 * Get compressed audio URLs for multiple vocabulary items
 */
router.post('/batch-urls', authenticateToken, async (req, res) => {
  try {
    const { vocabIds, bitrate = 64, format = 'mp3' } = req.body;
    
    if (!Array.isArray(vocabIds) || vocabIds.length === 0) {
      return res.validationError([
        { field: 'vocabIds', message: 'Vocabulary IDs array is required' }
      ]);
    }
    
    // Limit batch size
    const limitedIds = vocabIds.slice(0, 50);
    
    const vocabs = await prisma.vocab.findMany({
      where: {
        id: { in: limitedIds },
        audioUrl: { not: null }
      },
      select: {
        id: true,
        lemma: true,
        audioUrl: true
      }
    });
    
    const audioUrls = vocabs.map(vocab => ({
      id: vocab.id,
      word: vocab.lemma,
      url: `/api/mobile/audio/compressed/${vocab.id}?bitrate=${bitrate}&format=${format}`,
      originalUrl: vocab.audioUrl
    }));
    
    res.success(audioUrls, {
      count: audioUrls.length,
      bitrate,
      format
    });
    
  } catch (error) {
    console.error('Mobile audio batch URLs error:', error);
    res.serverError('Failed to generate audio URLs');
  }
});

/**
 * GET /api/mobile/audio/preload
 * Preload and cache audio files for offline use
 */
router.post('/preload', authenticateToken, async (req, res) => {
  try {
    const { vocabIds, bitrate = 64 } = req.body;
    const userId = req.user.id;
    
    if (!Array.isArray(vocabIds) || vocabIds.length === 0) {
      return res.validationError([
        { field: 'vocabIds', message: 'Vocabulary IDs array is required' }
      ]);
    }
    
    // Limit preload batch size
    const limitedIds = vocabIds.slice(0, 20);
    
    const vocabs = await prisma.vocab.findMany({
      where: {
        id: { in: limitedIds },
        audioUrl: { not: null }
      },
      select: {
        id: true,
        lemma: true,
        audioUrl: true,
        level: true
      }
    });
    
    const preloadResults = [];
    
    for (const vocab of vocabs) {
      try {
        const audioPath = path.join(__dirname, '../../../', vocab.audioUrl);
        const cacheKey = getCacheKey(audioPath, bitrate, 'mp3');
        const cachedFilePath = path.join(CACHE_DIR, `${cacheKey}.mp3`);
        
        // Check if already cached
        try {
          await fs.access(cachedFilePath);
          preloadResults.push({
            id: vocab.id,
            word: vocab.lemma,
            status: 'cached',
            url: `/api/mobile/audio/compressed/${vocab.id}?bitrate=${bitrate}`
          });
        } catch (error) {
          // Try to compress and cache
          try {
            await compressAudio(audioPath, cachedFilePath, bitrate);
            preloadResults.push({
              id: vocab.id,
              word: vocab.lemma,
              status: 'compressed',
              url: `/api/mobile/audio/compressed/${vocab.id}?bitrate=${bitrate}`
            });
          } catch (compressionError) {
            preloadResults.push({
              id: vocab.id,
              word: vocab.lemma,
              status: 'failed',
              error: 'Compression failed'
            });
          }
        }
      } catch (error) {
        preloadResults.push({
          id: vocab.id,
          word: vocab.lemma,
          status: 'error',
          error: error.message
        });
      }
    }
    
    const successful = preloadResults.filter(r => r.status !== 'error' && r.status !== 'failed');
    const failed = preloadResults.filter(r => r.status === 'error' || r.status === 'failed');
    
    res.batch(successful, failed, {
      bitrate,
      cacheDir: CACHE_DIR
    });
    
  } catch (error) {
    console.error('Mobile audio preload error:', error);
    res.serverError('Failed to preload audio files');
  }
});

/**
 * DELETE /api/mobile/audio/cache
 * Clear audio cache (admin only)
 */
router.delete('/cache', authenticateToken, async (req, res) => {
  try {
    // Check if user is admin (you might want to implement proper admin check)
    if (req.user.email !== 'admin@example.com') {
      return res.authError('Admin access required');
    }
    
    const files = await fs.readdir(CACHE_DIR);
    let deletedCount = 0;
    
    for (const file of files) {
      try {
        await fs.unlink(path.join(CACHE_DIR, file));
        deletedCount++;
      } catch (error) {
        console.error(`Failed to delete cache file ${file}:`, error);
      }
    }
    
    res.success(null, {
      deletedFiles: deletedCount,
      message: `Cleared ${deletedCount} cached audio files`
    });
    
  } catch (error) {
    console.error('Clear audio cache error:', error);
    res.serverError('Failed to clear audio cache');
  }
});

module.exports = router;