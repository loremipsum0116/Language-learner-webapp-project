#!/usr/bin/env node

/**
 * GCS 일본어 오디오 폴더 구조 분석 스크립트
 *
 * 목적:
 * 1. Google Cloud Storage의 실제 jlpt 폴더 구조 파악
 * 2. 각 레벨별 실제 폴더명 목록 수집
 * 3. 프론트엔드 경로 생성 로직과 비교 분석
 * 4. 매핑 테이블 생성을 위한 기초 데이터 수집
 */

const https = require('https');
const fs = require('fs');

/**
 * GCS 공개 버킷의 XML API를 통한 폴더 목록 조회
 * https://storage.googleapis.com/storage/v1/b/language-learner-audio/o?prefix=jlpt/
 */
function fetchGcsObjects(prefix = 'jlpt/') {
  return new Promise((resolve, reject) => {
    const url = `https://storage.googleapis.com/storage/v1/b/language-learner-audio/o?prefix=${prefix}&delimiter=/`;

    https.get(url, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve(parsed);
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', (err) => {
      reject(err);
    });
  });
}

/**
 * 특정 JLPT 레벨의 폴더 목록 조회
 */
function fetchJlptLevelFolders(level) {
  return fetchGcsObjects(`jlpt/${level}/`);
}

/**
 * 폴더명에서 일본어 단어 추출 (URL 디코딩)
 */
function extractWordFromPath(path) {
  // jlpt/n5/folderName/ → folderName
  const folderName = path.replace(/^jlpt\/[^/]+\//, '').replace(/\/$/, '');

  try {
    // URL 디코딩 시도
    return decodeURIComponent(folderName);
  } catch (e) {
    // 디코딩 실패 시 원본 반환
    return folderName;
  }
}

/**
 * 메인 분석 함수
 */
async function analyzeGcsStructure() {
  console.log('🔍 GCS 일본어 오디오 폴더 구조 분석 시작...');

  const results = {
    timestamp: new Date().toISOString(),
    totalFolders: 0,
    levels: {},
    folderNamePatterns: {
      encoded: [], // URL 인코딩된 폴더들
      spaces: [], // 공백 포함 폴더들
      hyphens: [], // 하이픈 포함 폴더들
      japanese: [], // 일본어 문자 폴더들
      english: [] // 영어 폴더들
    },
    sampleMappings: [] // 단어 → 폴더명 매핑 샘플들
  };

  const jlptLevels = ['n1', 'n2', 'n3', 'n4', 'n5'];

  for (const level of jlptLevels) {
    console.log(`📂 ${level.toUpperCase()} 레벨 폴더 조회 중...`);

    try {
      const response = await fetchJlptLevelFolders(level);

      const folders = response.prefixes || [];
      results.levels[level] = {
        totalFolders: folders.length,
        folders: [],
        samples: []
      };

      console.log(`   └─ ${folders.length}개 폴더 발견`);

      // 각 폴더 분석
      folders.forEach((folderPath, index) => {
        const folderName = folderPath.replace(`jlpt/${level}/`, '').replace(/\/$/, '');
        const decodedWord = extractWordFromPath(folderPath);

        results.levels[level].folders.push({
          originalPath: folderPath,
          folderName: folderName,
          decodedWord: decodedWord,
          hasSpaces: folderName.includes(' '),
          hasHyphens: folderName.includes('-'),
          hasUnderscore: folderName.includes('_'),
          isEncoded: folderName !== decodedWord,
          isJapanese: /[\u3040-\u309f\u30a0-\u30ff\u4e00-\u9faf]/.test(decodedWord),
          isEnglish: /^[a-zA-Z\s\-']+$/.test(decodedWord)
        });

        // 처음 20개만 샘플로 저장
        if (index < 20) {
          results.levels[level].samples.push({
            folderName,
            decodedWord,
            fullPath: folderPath
          });
        }

        // 패턴별 분류
        const folderInfo = { level, folderName, decodedWord, fullPath: folderPath };

        if (folderName !== decodedWord) {
          results.folderNamePatterns.encoded.push(folderInfo);
        }
        if (folderName.includes(' ')) {
          results.folderNamePatterns.spaces.push(folderInfo);
        }
        if (folderName.includes('-')) {
          results.folderNamePatterns.hyphens.push(folderInfo);
        }
        if (/[\u3040-\u309f\u30a0-\u30ff\u4e00-\u9faf]/.test(decodedWord)) {
          results.folderNamePatterns.japanese.push(folderInfo);
        }
        if (/^[a-zA-Z\s\-']+$/.test(decodedWord)) {
          results.folderNamePatterns.english.push(folderInfo);
        }
      });

      results.totalFolders += folders.length;

    } catch (error) {
      console.error(`❌ ${level} 레벨 조회 실패:`, error.message);
      results.levels[level] = { error: error.message };
    }

    // API 호출 간격 조절
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  // 매핑 샘플 생성 (각 레벨에서 처음 10개씩)
  Object.entries(results.levels).forEach(([level, levelData]) => {
    if (levelData.samples) {
      levelData.samples.slice(0, 10).forEach(sample => {
        results.sampleMappings.push({
          level: level.toUpperCase(),
          expectedWord: sample.decodedWord,
          actualFolderName: sample.folderName,
          fullGcsPath: `https://storage.googleapis.com/language-learner-audio/${sample.fullPath}word.mp3`,
          needsMapping: sample.folderName !== sample.decodedWord
        });
      });
    }
  });

  // 결과 파일 저장
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const jsonFileName = `gcs-structure-analysis-${timestamp}.json`;
  const reportFileName = `gcs-structure-report-${timestamp}.txt`;

  // JSON 상세 데이터
  fs.writeFileSync(jsonFileName, JSON.stringify(results, null, 2));

  // 텍스트 리포트
  const report = generateStructureReport(results);
  fs.writeFileSync(reportFileName, report);

  console.log(`\n📄 상세 데이터 저장: ${jsonFileName}`);
  console.log(`📄 분석 리포트 저장: ${reportFileName}`);
  console.log('\n' + report);

  return results;
}

/**
 * 구조 분석 리포트 생성
 */
function generateStructureReport(results) {
  const report = `
=== GCS 일본어 오디오 폴더 구조 분석 리포트 ===
분석 시간: ${new Date(results.timestamp).toLocaleString('ko-KR')}

📊 전체 통계:
- 총 폴더 수: ${results.totalFolders}개
- 분석 레벨: N1, N2, N3, N4, N5

📂 레벨별 폴더 수:
${Object.entries(results.levels).map(([level, data]) =>
  `- ${level.toUpperCase()}: ${data.totalFolders || 0}개`
).join('\n')}

🔍 폴더명 패턴 분석:
- URL 인코딩된 폴더: ${results.folderNamePatterns.encoded.length}개
- 공백 포함 폴더: ${results.folderNamePatterns.spaces.length}개
- 하이픈 포함 폴더: ${results.folderNamePatterns.hyphens.length}개
- 일본어 문자 폴더: ${results.folderNamePatterns.japanese.length}개
- 영어 폴더: ${results.folderNamePatterns.english.length}개

🎯 매핑이 필요한 폴더들 (상위 20개):
${results.sampleMappings.filter(m => m.needsMapping).slice(0, 20).map(mapping =>
  `- ${mapping.level}: "${mapping.expectedWord}" → "${mapping.actualFolderName}"`
).join('\n')}

📁 각 레벨별 샘플 폴더 (처음 10개):

${Object.entries(results.levels).map(([level, data]) => {
  if (!data.samples) return `${level.toUpperCase()}: 조회 실패`;

  return `${level.toUpperCase()}:\n${data.samples.map(sample =>
    `  - ${sample.folderName} → "${sample.decodedWord}"`
  ).join('\n')}`;
}).join('\n\n')}

🚨 주요 문제점:
1. URL 인코딩: 한자가 %E5%... 형태로 인코딩되어 저장됨
2. 공백 vs 하이픈: 일관성 없는 구분자 사용
3. 프론트엔드 로직 불일치: 현재 로직이 실제 폴더명과 맞지 않음

🎯 해결 방안:
1. 실제 GCS 폴더명 기반 매핑 테이블 생성
2. 프론트엔드 경로 생성 로직에 매핑 적용
3. 데이터베이스 audioLocal 필드 업데이트

상세한 데이터는 JSON 파일을 확인하세요.
`;

  return report;
}

// 스크립트 실행
if (require.main === module) {
  analyzeGcsStructure().catch(console.error);
}

module.exports = { analyzeGcsStructure, fetchGcsObjects, extractWordFromPath };