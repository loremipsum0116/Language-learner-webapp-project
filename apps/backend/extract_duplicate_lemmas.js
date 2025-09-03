// server/extract_duplicate_lemmas.js
// cefr_vocabs.json에서 중복된 lemma들만 추출하여 별도 JSON 파일 생성

const fs = require('fs');
const path = require('path');

const inputFile = path.join(__dirname, 'cefr_vocabs.json');
const outputFile = path.join(__dirname, 'cefr_vocabs_duplicates.json');

try {
    console.log('🔍 Reading cefr_vocabs.json...');
    
    // JSON 파일 읽기
    const rawData = fs.readFileSync(inputFile, 'utf8');
    const vocabs = JSON.parse(rawData);
    
    console.log(`📊 Total words in original file: ${vocabs.length}`);
    
    // lemma를 기준으로 중복 찾기
    const lemmaMap = new Map();
    
    // 첫 번째 패스: 모든 lemma 카운팅
    vocabs.forEach(vocab => {
        const lemma = vocab.lemma;
        if (!lemmaMap.has(lemma)) {
            lemmaMap.set(lemma, []);
        }
        lemmaMap.get(lemma).push(vocab);
    });
    
    // 중복된 lemma들만 찾기 (2개 이상 등장하는 것들)
    const duplicateVocabs = [];
    const duplicateLemmas = [];
    
    lemmaMap.forEach((vocabList, lemma) => {
        if (vocabList.length > 1) {
            duplicateLemmas.push(lemma);
            // 해당 lemma의 모든 항목을 duplicateVocabs에 추가
            duplicateVocabs.push(...vocabList);
        }
    });
    
    console.log(`\n📈 Statistics:`);
    console.log(`   Total unique lemmas: ${lemmaMap.size}`);
    console.log(`   Duplicate lemmas: ${duplicateLemmas.length}`);
    console.log(`   Total duplicate entries: ${duplicateVocabs.length}`);
    
    // 중복 lemma들을 알파벳 순으로 정렬
    duplicateLemmas.sort();
    
    console.log(`\n🔄 Duplicate lemmas found:`);
    duplicateLemmas.forEach(lemma => {
        const entries = lemmaMap.get(lemma);
        const levels = entries.map(entry => entry.levelCEFR).join(', ');
        console.log(`   "${lemma}" appears ${entries.length} times (Levels: ${levels})`);
    });
    
    // 레벨별 통계 출력
    const levelStats = {};
    duplicateVocabs.forEach(vocab => {
        const level = vocab.levelCEFR;
        levelStats[level] = (levelStats[level] || 0) + 1;
    });
    
    console.log(`\n📚 Duplicate entries by level:`);
    Object.keys(levelStats).sort().forEach(level => {
        console.log(`   ${level}: ${levelStats[level]} entries`);
    });
    
    // 중복 단어들을 lemma 순으로 정렬하여 저장
    duplicateVocabs.sort((a, b) => {
        if (a.lemma === b.lemma) {
            // 같은 lemma인 경우 레벨 순으로 정렬 (A1, A2, B1, B2, C1)
            const levelOrder = { 'A1': 1, 'A2': 2, 'B1': 3, 'B2': 4, 'C1': 5 };
            return levelOrder[a.levelCEFR] - levelOrder[b.levelCEFR];
        }
        return a.lemma.localeCompare(b.lemma);
    });
    
    // 중복 단어들을 새 파일로 저장
    fs.writeFileSync(outputFile, JSON.stringify(duplicateVocabs, null, 2), 'utf8');
    
    console.log(`\n✅ Success! Duplicate vocabulary saved to: ${path.basename(outputFile)}`);
    console.log(`📁 File location: ${outputFile}`);
    
} catch (error) {
    console.error('❌ Error processing file:', error.message);
    process.exit(1);
}