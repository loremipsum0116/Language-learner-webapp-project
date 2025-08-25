// server/remove_duplicate_lemmas.js
// cefr_vocabs.json에서 중복된 lemma를 제거하여 고유한 단어들만 포함된 JSON 파일 생성

const fs = require('fs');
const path = require('path');

const inputFile = path.join(__dirname, 'cefr_vocabs.json');
const outputFile = path.join(__dirname, 'cefr_vocabs_unique.json');

try {
    console.log('🔍 Reading cefr_vocabs.json...');
    
    // JSON 파일 읽기
    const rawData = fs.readFileSync(inputFile, 'utf8');
    const vocabs = JSON.parse(rawData);
    
    console.log(`📊 Total words in original file: ${vocabs.length}`);
    
    // lemma를 기준으로 중복 제거
    const uniqueVocabs = [];
    const seenLemmas = new Set();
    
    let duplicateCount = 0;
    
    for (const vocab of vocabs) {
        const lemma = vocab.lemma;
        
        if (!seenLemmas.has(lemma)) {
            // 처음 보는 lemma인 경우 추가
            seenLemmas.add(lemma);
            uniqueVocabs.push(vocab);
        } else {
            // 중복된 lemma인 경우 카운트
            duplicateCount++;
            console.log(`🔄 Duplicate found: "${lemma}" (Level: ${vocab.levelCEFR})`);
        }
    }
    
    console.log(`\n📈 Statistics:`);
    console.log(`   Original words: ${vocabs.length}`);
    console.log(`   Unique words: ${uniqueVocabs.length}`);
    console.log(`   Duplicates removed: ${duplicateCount}`);
    
    // 레벨별 통계 출력
    const levelStats = {};
    uniqueVocabs.forEach(vocab => {
        const level = vocab.levelCEFR;
        levelStats[level] = (levelStats[level] || 0) + 1;
    });
    
    console.log(`\n📚 Words by level:`);
    Object.keys(levelStats).sort().forEach(level => {
        console.log(`   ${level}: ${levelStats[level]} words`);
    });
    
    // 고유한 단어들을 새 파일로 저장
    fs.writeFileSync(outputFile, JSON.stringify(uniqueVocabs, null, 2), 'utf8');
    
    console.log(`\n✅ Success! Unique vocabulary saved to: ${path.basename(outputFile)}`);
    console.log(`📁 File location: ${outputFile}`);
    
} catch (error) {
    console.error('❌ Error processing file:', error.message);
    process.exit(1);
}