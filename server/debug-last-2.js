// Debug the last 2 words
const fs = require('fs');

const cefrData = JSON.parse(fs.readFileSync('./cefr_vocabs.json', 'utf8'));
const failed = cefrData.filter(word => !word.example || word.example === '');

console.log('마지막 2개 실패 단어들 상세 분석:\n');

failed.forEach((word, index) => {
    console.log(`${index + 1}. 단어: ${word.lemma}`);
    console.log(`   전체 chirpScript:`);
    console.log(`   ${word.koChirpScript}`);
    console.log('');
    
    // 문자별 분석
    console.log('   문자별 분석:');
    const key_section = word.koChirpScript.substring(word.koChirpScript.indexOf('"'), word.koChirpScript.indexOf('라는') + 10);
    console.log(`   키 섹션: ${key_section}`);
    
    // 따옴표 내용 추출 시도
    const quotes = word.koChirpScript.match(/"[^"]*"/g);
    if (quotes) {
        console.log(`   따옴표 내용들: ${quotes.join(', ')}`);
    }
    
    console.log('-'.repeat(80));
});

// 수동 패턴 테스트
console.log('\n수동 패턴 테스트:');

const testPatterns = [
    /"Are you coming\?" "Yeah\."/,
    /"Are you ready\?" "Yes, I am\."/,
    /"[^"]*\?" "[^"]*\."/,
    /("[^"]*\?" "[^"]*\.")/,
    /("[^"]*coming\?" "[^"]*\.")/,
    /("[^"]*ready\?" "[^"]*\.")/,
];

failed.forEach(word => {
    console.log(`\n${word.lemma} 테스트:`);
    testPatterns.forEach((pattern, i) => {
        const match = word.koChirpScript.match(pattern);
        if (match) {
            console.log(`  ✅ 패턴 ${i + 1}: "${match[1] || match[0]}"`);
        }
    });
});