#!/usr/bin/env node

/**
 * 일본어 오디오 경로 빠른 샘플 검증 (50개만)
 */

const { PrismaClient } = require('@prisma/client');
const https = require('https');

const prisma = new PrismaClient();

// 올바른 GCS 베이스 URL (public 경로 포함)
const GCS_BASE_URL = 'https://storage.googleapis.com/language-learner-audio/public';

function parseAudioLocal(audioLocal) {
  if (!audioLocal) return null;

  let audioData = null;

  try {
    if (typeof audioLocal === 'string' && audioLocal.startsWith('{')) {
      audioData = JSON.parse(audioLocal);
    } else if (typeof audioLocal === 'string') {
      const basePath = audioLocal.replace(/\/(word|gloss|example)\.mp3$/, '');
      audioData = {
        word: `${basePath}/word.mp3`,
        gloss: `${basePath}/gloss.mp3`,
        example: `${basePath}/example.mp3`
      };
    } else if (typeof audioLocal === 'object') {
      audioData = audioLocal;
    }
  } catch (e) {
    const basePath = audioLocal.replace(/\/(word|gloss|example)\.mp3$/, '');
    audioData = {
      word: `${basePath}/word.mp3`,
      gloss: `${basePath}/gloss.mp3`,
      example: `${basePath}/example.mp3`
    };
  }

  if (audioData && typeof audioData === 'object') {
    const convertToGcsUrl = (path) => {
      if (!path) return path;
      if (path.startsWith('https://storage.googleapis.com/')) return path;
      const cleanPath = path.startsWith('/') ? path.substring(1) : path;
      return `${GCS_BASE_URL}/${cleanPath}`;
    };

    return {
      word: convertToGcsUrl(audioData.word),
      gloss: convertToGcsUrl(audioData.gloss),
      example: convertToGcsUrl(audioData.example)
    };
  }

  return null;
}

function generateVocabListAudioPath(vocab) {
  const isJapanese = vocab.levelJLPT || vocab.source === 'jlpt' || vocab.source === 'jlpt_total' ||
                     (vocab.audioLocal && vocab.audioLocal.includes('jlpt/'));

  if (!isJapanese) return null;

  // 1. audioLocal 우선 사용
  if (vocab.audioLocal) {
    const audioData = parseAudioLocal(vocab.audioLocal);
    if (audioData?.word) {
      return {
        method: 'audioLocal_parsed',
        word: audioData.word
      };
    }
  }

  // 2. lemma 기반 경로 생성 (최종 fallback)
  const jlptLevel = (vocab.levelJLPT || 'N5').toLowerCase();
  let folderName;

  if (vocab.romaji) {
    folderName = vocab.romaji.toLowerCase();
  } else {
    folderName = vocab.lemma.toLowerCase().replace(/・/g, ' ');
  }

  return {
    method: 'lemma_based_fallback',
    word: `${GCS_BASE_URL}/jlpt/${jlptLevel}/${encodeURIComponent(folderName)}/word.mp3`
  };
}

function checkFileExists(url) {
  return new Promise((resolve) => {
    const req = https.request(url, { method: 'HEAD' }, (res) => {
      resolve({
        exists: res.statusCode === 200,
        status: res.statusCode
      });
    });

    req.on('error', (err) => {
      resolve({
        exists: false,
        error: err.message
      });
    });

    req.setTimeout(5000, () => {
      req.destroy();
      resolve({
        exists: false,
        error: 'timeout'
      });
    });

    req.end();
  });
}

async function quickValidateSample() {
  console.log('🔍 일본어 오디오 빠른 샘플 검증 (처음 50개)...');

  try {
    const rows = await prisma.vocab.findMany({
      where: {
        OR: [
          { source: 'jlpt_total' },
          { levelJLPT: { not: null } }
        ]
      },
      include: {
        dictentry: {
          select: {
            audioLocal: true,
            audioUrl: true
          }
        }
      },
      orderBy: [
        { levelJLPT: 'asc' },
        { lemma: 'asc' }
      ],
      take: 50
    });

    console.log(`📊 샘플 ${rows.length}개 검증 중...`);

    const results = [];

    for (let i = 0; i < rows.length; i++) {
      const vocab = {
        ...rows[i],
        audioLocal: rows[i].dictentry?.audioLocal,
        audioUrl: rows[i].dictentry?.audioUrl
      };

      const paths = generateVocabListAudioPath(vocab);
      if (paths) {
        console.log(`${i + 1}/50: ${vocab.lemma} (${vocab.levelJLPT})`);

        const check = await checkFileExists(paths.word);

        results.push({
          id: vocab.id,
          lemma: vocab.lemma,
          levelJLPT: vocab.levelJLPT,
          method: paths.method,
          wordPath: paths.word,
          exists: check.exists,
          status: check.status,
          error: check.error
        });

        if (check.exists) {
          console.log(`  ✅ 성공: ${paths.word}`);
        } else {
          console.log(`  ❌ 실패 (${check.status || check.error}): ${paths.word}`);
        }
      }
    }

    // 결과 요약
    const successCount = results.filter(r => r.exists).length;
    const failCount = results.filter(r => !r.exists).length;

    console.log(`\n📊 샘플 검증 결과:`);
    console.log(`✅ 성공: ${successCount}개 (${(successCount/results.length*100).toFixed(1)}%)`);
    console.log(`❌ 실패: ${failCount}개 (${(failCount/results.length*100).toFixed(1)}%)`);

    // 실패한 케이스들
    if (failCount > 0) {
      console.log(`\n❌ 실패한 케이스들:`);
      results.filter(r => !r.exists).forEach(r => {
        console.log(`  - ${r.lemma} (${r.levelJLPT}): ${r.status || r.error}`);
      });
    }

    // 성공한 케이스들
    if (successCount > 0) {
      console.log(`\n✅ 성공한 케이스들 (처음 10개):`);
      results.filter(r => r.exists).slice(0, 10).forEach(r => {
        console.log(`  - ${r.lemma} (${r.levelJLPT}): OK`);
      });
    }

  } finally {
    await prisma.$disconnect();
  }
}

quickValidateSample().catch(console.error);