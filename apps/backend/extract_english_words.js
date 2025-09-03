// server/extract_english_words.js
// 수능완성.txt 파일에서 영단어(lemma)만 추출

const fs = require('fs');
const path = require('path');

const inputFile = path.join(__dirname, '수능완성.txt');
const outputFile = path.join(__dirname, '수능완성_영단어만.txt');

try {
    console.log('🔍 Reading 수능완성.txt...');
    
    // JSON 파일 읽기
    const rawData = fs.readFileSync(inputFile, 'utf8');
    const vocabData = JSON.parse(rawData);
    
    console.log(`📊 Total entries in file: ${vocabData.length}`);
    
    // lemma만 추출
    const englishWords = vocabData.map(item => item.lemma).filter(lemma => lemma && lemma.trim());
    
    // 중복 제거
    const uniqueWords = [...new Set(englishWords)];
    
    console.log(`📈 Statistics:`);
    console.log(`   Total lemmas: ${englishWords.length}`);
    console.log(`   Unique words: ${uniqueWords.length}`);
    console.log(`   Duplicates: ${englishWords.length - uniqueWords.length}`);
    
    // 알파벳 순으로 정렬
    uniqueWords.sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
    
    // 파일로 저장 (각 단어를 한 줄씩)
    const output = uniqueWords.join('\n');
    fs.writeFileSync(outputFile, output, 'utf8');
    
    console.log(`\n📝 Sample words (first 10):`);
    uniqueWords.slice(0, 10).forEach((word, index) => {
        console.log(`   ${index + 1}. ${word}`);
    });
    
    console.log(`\n📝 Sample words (last 10):`);
    uniqueWords.slice(-10).forEach((word, index) => {
        console.log(`   ${uniqueWords.length - 9 + index}. ${word}`);
    });
    
    console.log(`\n✅ Success! English words extracted to: ${path.basename(outputFile)}`);
    console.log(`📁 File location: ${outputFile}`);
    console.log(`📊 Total unique English words: ${uniqueWords.length}`);
    
} catch (error) {
    console.error('❌ Error extracting English words:', error.message);
    process.exit(1);
}