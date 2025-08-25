// server/remove_duplicates_from_wordlist.js
// 수능완성_영단어만.txt에서 중복 단어 제거 (괄호 포함 단어도 처리)

const fs = require('fs');
const path = require('path');

const inputFile = path.join(__dirname, '수능완성_영단어만.txt');
const outputFile = path.join(__dirname, '수능완성_영단어만_중복제거.txt');

// 기본 단어 추출 함수 (괄호와 내용 제거)
function getBaseWord(word) {
    // 괄호와 그 안의 내용 제거
    return word.replace(/\s*\([^)]*\)\s*/g, '').trim().toLowerCase();
}

try {
    console.log('🔍 Reading 수능완성_영단어만.txt...');
    
    // 파일 읽기
    const content = fs.readFileSync(inputFile, 'utf8');
    const words = content.split('\n')
        .map(word => word.trim())
        .filter(word => word.length > 0); // 빈 줄 제거
    
    console.log(`📊 Total words in file: ${words.length}`);
    
    // 중복 제거 처리
    const uniqueWords = [];
    const seenBaseWords = new Set();
    let duplicateCount = 0;
    
    for (const word of words) {
        const baseWord = getBaseWord(word);
        
        if (!seenBaseWords.has(baseWord)) {
            // 처음 보는 기본 단어인 경우
            seenBaseWords.add(baseWord);
            uniqueWords.push(word);
        } else {
            // 중복된 기본 단어인 경우
            duplicateCount++;
            console.log(`🔄 Duplicate removed: "${word}" (base word: "${baseWord}")`);
        }
    }
    
    // 결과를 알파벳 순으로 정렬
    uniqueWords.sort((a, b) => {
        const baseA = getBaseWord(a);
        const baseB = getBaseWord(b);
        return baseA.localeCompare(baseB);
    });
    
    console.log(`\n📈 Processing Summary:`);
    console.log(`   Original words: ${words.length}`);
    console.log(`   Unique words: ${uniqueWords.length}`);
    console.log(`   Duplicates removed: ${duplicateCount}`);
    
    // 파일로 저장 (각 단어를 한 줄씩)
    const output = uniqueWords.join('\n');
    fs.writeFileSync(outputFile, output, 'utf8');
    
    console.log(`\n📝 Sample unique words (first 20):`);
    uniqueWords.slice(0, 20).forEach((word, index) => {
        const baseWord = getBaseWord(word);
        console.log(`   ${index + 1}. ${word}${word !== baseWord ? ` (base: ${baseWord})` : ''}`);
    });
    
    if (uniqueWords.length > 20) {
        console.log(`\n📝 Sample unique words (last 10):`);
        uniqueWords.slice(-10).forEach((word, index) => {
            const baseWord = getBaseWord(word);
            const actualIndex = uniqueWords.length - 9 + index;
            console.log(`   ${actualIndex}. ${word}${word !== baseWord ? ` (base: ${baseWord})` : ''}`);
        });
    }
    
    // 제거된 중복 예시 출력
    console.log(`\n📋 Examples of duplicates that were removed:`);
    const exampleDuplicates = [];
    const tempSeen = new Set();
    
    for (const word of words) {
        const baseWord = getBaseWord(word);
        if (tempSeen.has(baseWord)) {
            exampleDuplicates.push(`"${word}" (base: "${baseWord}")`);
            if (exampleDuplicates.length >= 10) break;
        } else {
            tempSeen.add(baseWord);
        }
    }
    
    exampleDuplicates.forEach((example, index) => {
        console.log(`   ${index + 1}. ${example}`);
    });
    
    console.log(`\n✅ Success! Deduplicated word list saved to: ${path.basename(outputFile)}`);
    console.log(`📁 File location: ${outputFile}`);
    console.log(`📊 Final unique words: ${uniqueWords.length}`);
    
} catch (error) {
    console.error('❌ Error processing word list:', error.message);
    process.exit(1);
}