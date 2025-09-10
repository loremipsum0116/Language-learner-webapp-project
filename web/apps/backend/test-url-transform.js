// URL 변환 테스트
const pathMappings = {
  'bank-money': 'bank (money)',
  'bank-river': 'bank (river)',
  'rock-music': 'rock (music)',
  'rock-stone': 'rock (stone)',
  'light-not-heavy': 'light (not heavy)',
  'light-from-the-sun': 'light (from the suna lamp)',
  'last-taking-time': 'last (taking time)',
};

const transformAudioPath = (path) => {
  if (!path) return path;
  
  // 경로 매핑 적용
  let transformedPath = path;
  Object.entries(pathMappings).forEach(([from, to]) => {
    if (transformedPath.includes(from)) {
      transformedPath = transformedPath.replace(from, to);
    }
  });
  
  return transformedPath;
};

const encodeAudioPath = (path) => {
  if (!path) return path;
  
  // 각 경로 세그먼트를 개별적으로 인코딩
  const segments = path.split('/');
  const encodedSegments = segments.map(segment => {
    // 파일/폴더 이름의 특수문자 인코딩
    return segment
      .replace(/ /g, '%20')           // 공백
      .replace(/\(/g, '%28')          // 왼쪽 괄호
      .replace(/\)/g, '%29');         // 오른쪽 괄호
  });
  
  return encodedSegments.join('/');
};

// 테스트 케이스들
const testCases = [
  'starter/bank-money/word.mp3',
  'starter/bank-money/gloss.mp3',
  'intermediate/bank-river/word.mp3',
  'elementary/banker/word.mp3'
];

console.log('=== URL 변환 테스트 ===');
testCases.forEach(original => {
  const transformed = transformAudioPath(original);
  const encoded = encodeAudioPath(transformed);
  const fullUrl = `http://localhost:4000/${encoded}`;
  
  console.log('\n원본:', original);
  console.log('변환:', transformed);
  console.log('인코딩:', encoded);
  console.log('완전한 URL:', fullUrl);
});

console.log('\n=== 실제 파일 테스트 ===');
const { spawn } = require('child_process');

testCases.forEach(original => {
  const transformed = transformAudioPath(original);
  const encoded = encodeAudioPath(transformed);
  const fullUrl = `http://localhost:4000/${encoded}`;
  
  console.log(`\n테스트 중: ${fullUrl}`);
  
  // curl 테스트 (비동기로 실행)
  const curl = spawn('curl', ['-I', fullUrl]);
  curl.stdout.on('data', (data) => {
    const output = data.toString();
    if (output.includes('200 OK')) {
      console.log('✅ 성공!');
    }
  });
  curl.stderr.on('data', (data) => {
    console.log('❌ 실패:', data.toString());
  });
});