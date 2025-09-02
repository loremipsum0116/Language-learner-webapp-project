// server/extract_language_words_text.js
// 수능완성.txt 텍스트 파일에서 영단어만 추출

const fs = require('fs');
const path = require('path');

const inputFile = path.join(__dirname, '수능완성.txt');
const outputFile = path.join(__dirname, '수능완성_영단어만.txt');

// 언어 단어인지 확인하는 함수
function isLanguageWord(word) {
    // 기본적으로 영어 알파벳으로만 구성된 단어
    const languagePattern = /^[a-zA-Z]+$/;
    
    // 특수한 경우들 (하이픈, 어포스트로피 포함)
    const specialLanguagePattern = /^[a-zA-Z]+['-]?[a-zA-Z]*$/;
    
    return languagePattern.test(word) || specialLanguagePattern.test(word);
}

// 한국어나 숫자로 시작하는 설명 라인인지 확인
function isExplanationLine(line) {
    const trimmed = line.trim();
    // 한국어로 시작하거나, 품사 약어로 시작하는 라인 (n., v., a., adv. 등)
    return /^[가-힣]/.test(trimmed) || 
           /^[nvaprep]\.\s/.test(trimmed) || 
           /^\d+\/\d+$/.test(trimmed) || // 페이지 번호
           trimmed === '수능특강' ||
           trimmed === '영어' ||
           trimmed.includes('수능특강') ||
           trimmed.includes('수능완성') ||
           trimmed.includes('영어독해연습') ||
           trimmed.includes('영어듣기') ||
           trimmed === '' ||
           /^[0-9]/.test(trimmed);
}

try {
    console.log('🔍 Reading 수능완성.txt...');
    
    // 텍스트 파일 읽기
    const content = fs.readFileSync(inputFile, 'utf8');
    const lines = content.split('\n');
    
    console.log(`📊 Total lines in file: ${lines.length}`);
    
    const languageWords = new Set();
    let totalWordsFound = 0;
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        
        // 빈 라인이나 설명 라인 건너뛰기
        if (!line || isExplanationLine(line)) {
            continue;
        }
        
        // 라인을 단어로 분할
        const words = line.split(/\s+/);
        
        for (const word of words) {
            const cleanWord = word.trim();
            
            // 영어 단어인지 확인
            if (cleanWord && isLanguageWord(cleanWord)) {
                // 특수 문자 제거 (마침표, 쉼표 등)
                const cleanedWord = cleanWord.replace(/[.,;:!?()[\]{}]/g, '').toLowerCase();
                
                if (cleanedWord && cleanedWord.length > 1) { // 1글자 단어는 제외 (a, I 등은 별도 처리 필요시)
                    languageWords.add(cleanedWord);
                    totalWordsFound++;
                }
            }
        }
    }
    
    // a, I 같은 1글자 중요 단어들 별도 추가
    const importantSingleLetterWords = ['a', 'I'];
    importantSingleLetterWords.forEach(word => languageWords.add(word));
    
    // 배열로 변환하고 정렬
    const uniqueWords = Array.from(languageWords).sort();
    
    console.log(`📈 Statistics:`);
    console.log(`   Total word instances found: ${totalWordsFound}`);
    console.log(`   Unique English words: ${uniqueWords.length}`);
    
    // 파일로 저장 (각 단어를 한 줄씩)
    const output = uniqueWords.join('\n');
    fs.writeFileSync(outputFile, output, 'utf8');
    
    console.log(`\n📝 Sample words (first 20):`);
    uniqueWords.slice(0, 20).forEach((word, index) => {
        console.log(`   ${index + 1}. ${word}`);
    });
    
    if (uniqueWords.length > 20) {
        console.log(`\n📝 Sample words (last 10):`);
        uniqueWords.slice(-10).forEach((word, index) => {
            console.log(`   ${uniqueWords.length - 9 + index}. ${word}`);
        });
    }
    
    console.log(`\n✅ Success! English words extracted to: ${path.basename(outputFile)}`);
    console.log(`📁 File location: ${outputFile}`);
    console.log(`📊 Total unique English words: ${uniqueWords.length}`);
    
} catch (error) {
    console.error('❌ Error extracting English words:', error.message);
    process.exit(1);
}