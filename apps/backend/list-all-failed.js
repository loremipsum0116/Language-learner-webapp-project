// server/list-all-failed.js
const fs = require('fs');

const cefrData = JSON.parse(fs.readFileSync('./cefr_vocabs.json', 'utf8'));

console.log('모든 실패한 단어들:');
const failed = cefrData.filter(word => !word.example || word.example === '');

console.log(`총 ${failed.length}개의 단어가 실패했습니다:\n`);

failed.forEach((word, index) => {
  console.log(`${index + 1}. ${word.lemma}`);
  console.log(`   chirpScript: ${word.koChirpScript?.substring(0, 100)}...`);
  console.log('');
});

// 실패한 단어들의 패턴 분석
console.log('\n=== 패턴 분석 ===');
const patterns = {};
failed.forEach(word => {
  const chirp = word.koChirpScript || '';
  
  // 마지막 문장 패턴 추출
  if (chirp.includes('라는 의미네요')) {
    patterns['라는 의미네요'] = (patterns['라는 의미네요'] || 0) + 1;
  }
  if (chirp.includes('라는 뜻입니다')) {
    patterns['라는 뜻입니다'] = (patterns['라는 뜻입니다'] || 0) + 1;
  }
  if (chirp.includes('이라는 의미네요')) {
    patterns['이라는 의미네요'] = (patterns['이라는 의미네요'] || 0) + 1;
  }
  
  // 구두점 패턴
  if (chirp.includes('?')) {
    patterns['물음표 포함'] = (patterns['물음표 포함'] || 0) + 1;
  }
  if (chirp.includes('!')) {
    patterns['느낌표 포함'] = (patterns['느낌표 포함'] || 0) + 1;
  }
  if (chirp.includes('.')) {
    patterns['마침표 포함'] = (patterns['마침표 포함'] || 0) + 1;
  }
});

console.log('패턴별 실패 개수:');
Object.entries(patterns).forEach(([pattern, count]) => {
  console.log(`  ${pattern}: ${count}개`);
});