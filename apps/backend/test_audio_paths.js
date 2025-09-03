const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// 오디오 테스트 함수
async function testAudioUrl(url) {
  return new Promise((resolve) => {
    const audio = new Audio(url);
    
    const timeout = setTimeout(() => {
      resolve({ success: false, error: 'Timeout' });
    }, 5000); // 5초 타임아웃
    
    audio.oncanplaythrough = () => {
      clearTimeout(timeout);
      resolve({ success: true });
    };
    
    audio.onerror = (e) => {
      clearTimeout(timeout);
      resolve({ success: false, error: e.type || 'LoadError' });
    };
    
    audio.onabort = () => {
      clearTimeout(timeout);
      resolve({ success: false, error: 'Aborted' });
    };
    
    audio.load();
  });
}

// 오디오 경로 파싱 함수
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
    } else {
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
  
  return audioData;
}

// 메인 테스트 함수
async function testAllVocabAudio() {
  try {
    console.log('🔍 단일 단어의 오디오 파일을 테스트합니다 (숙어/구동사 제외)...\n');
    
    // 숙어와 구동사 제외하고 단일 단어들만 가져오기
    const rows = await prisma.vocab.findMany({
      include: {
        dictentry: true
      },
      where: {
        dictentry: {
          OR: [
            { audioLocal: { not: null } },
            { audioUrl: { not: null } }
          ]
        },
        // 공백이 포함된 숙어/구동사 제외
        lemma: {
          not: {
            contains: ' '
          }
        }
      },
      orderBy: {
        lemma: 'asc'
      }
    });
    
    console.log(`📊 총 ${rows.length}개의 단어를 테스트합니다.\n`);
    
    const failedAudios = [];
    const baseUrl = 'http://localhost:4000';
    
    for (let i = 0; i < rows.length; i++) {
      const vocab = rows[i];
      const progress = `[${i + 1}/${rows.length}]`;
      
      console.log(`${progress} 테스트 중: ${vocab.lemma} (${vocab.levelCEFR || 'No level'})`);
      
      // audioLocal 파싱
      const audioData = parseAudioLocal(vocab.dictentry?.audioLocal);
      
      if (audioData) {
        // word, gloss, example 오디오 각각 테스트
        for (const [type, relativePath] of Object.entries(audioData)) {
          if (relativePath) {
            const fullUrl = `${baseUrl}/${relativePath}`;
            
            // 브라우저 환경이 아니므로 Node.js에서는 실제 오디오 로드 테스트 불가
            // 대신 URL 패턴 분석으로 문제 파일 식별
            
            // 괄호가 있는 경로 확인
            if (relativePath.includes('(') || relativePath.includes(')')) {
              console.log(`  ❌ ${type}: 괄호 포함 경로 - ${fullUrl}`);
              failedAudios.push({
                id: vocab.id,
                lemma: vocab.lemma,
                levelCEFR: vocab.levelCEFR,
                type: type,
                url: fullUrl,
                error: '괄호 포함 경로',
                originalPath: relativePath
              });
            }
            
            // URL 인코딩되지 않은 공백 확인
            if (relativePath.includes(' ') && !relativePath.includes('%20')) {
              console.log(`  ❌ ${type}: 인코딩되지 않은 공백 - ${fullUrl}`);
              failedAudios.push({
                id: vocab.id,
                lemma: vocab.lemma,
                levelCEFR: vocab.levelCEFR,
                type: type,
                url: fullUrl,
                error: '인코딩되지 않은 공백',
                originalPath: relativePath
              });
            }
            
            // 특수 문자 확인
            const specialChars = /[^a-zA-Z0-9._\-\/]/g;
            const matches = relativePath.match(specialChars);
            if (matches && !relativePath.includes('%')) {
              console.log(`  ❌ ${type}: 특수 문자 포함 - ${fullUrl}`);
              failedAudios.push({
                id: vocab.id,
                lemma: vocab.lemma,
                levelCEFR: vocab.levelCEFR,
                type: type,
                url: fullUrl,
                error: `특수 문자 포함: ${matches.join(', ')}`,
                originalPath: relativePath
              });
            }
          }
        }
      }
      
      // audioUrl도 체크
      if (vocab.dictentry?.audioUrl) {
        console.log(`  🔗 외부 URL: ${vocab.dictentry.audioUrl}`);
      }
    }
    
    console.log('\n' + '='.repeat(80));
    console.log('📋 테스트 결과 요약');
    console.log('='.repeat(80));
    
    if (failedAudios.length === 0) {
      console.log('🎉 모든 오디오 경로가 정상적으로 구성되어 있습니다!');
    } else {
      console.log(`❌ ${failedAudios.length}개의 문제 있는 오디오 경로를 발견했습니다:\n`);
      
      // 에러 유형별 그룹화
      const errorGroups = {};
      failedAudios.forEach(item => {
        const key = item.error;
        if (!errorGroups[key]) {
          errorGroups[key] = [];
        }
        errorGroups[key].push(item);
      });
      
      for (const [errorType, items] of Object.entries(errorGroups)) {
        console.log(`\n📍 ${errorType} (${items.length}개):`);
        items.forEach(item => {
          console.log(`  - ${item.lemma} (ID: ${item.id}) - ${item.type}`);
          console.log(`    경로: ${item.originalPath}`);
        });
      }
      
      // JSON 파일로 상세 결과 저장
      const fs = require('fs');
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `audio_test_results_${timestamp}.json`;
      
      fs.writeFileSync(filename, JSON.stringify({
        totalTested: rows.length,
        failedCount: failedAudios.length,
        timestamp: new Date().toISOString(),
        failedAudios: failedAudios,
        errorSummary: Object.keys(errorGroups).map(errorType => ({
          errorType,
          count: errorGroups[errorType].length
        }))
      }, null, 2));
      
      console.log(`\n💾 상세 결과가 ${filename} 파일에 저장되었습니다.`);
    }
    
  } catch (error) {
    console.error('❌ 테스트 중 오류 발생:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

// 실행
if (require.main === module) {
  testAllVocabAudio().catch(console.error);
}

module.exports = { testAllVocabAudio, parseAudioLocal };