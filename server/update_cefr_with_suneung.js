// server/update_cefr_with_suneung.js
// 수능완성_영단어만_중복제거.txt의 단어들이 cefr_vocabs.json에 있으면 levelCEFR에 "수능" 추가

const fs = require('fs');
const path = require('path');

const suneungWordsFile = path.join(__dirname, '수능완성_영단어만_중복제거.txt');
const cefrVocabsFile = path.join(__dirname, 'cefr_vocabs.json');
const outputFile = path.join(__dirname, 'cefr_vocabs_updated.json');

try {
    console.log('🔍 Reading files...');
    
    // 수능 단어 목록 읽기
    const suneungContent = fs.readFileSync(suneungWordsFile, 'utf8');
    const suneungWords = new Set(
        suneungContent
            .split('\n')
            .map(word => word.trim().toLowerCase())
            .filter(word => word.length > 0)
    );
    
    console.log(`📊 Loaded ${suneungWords.size} 수능 words`);
    
    // CEFR vocabs JSON 읽기
    const cefrContent = fs.readFileSync(cefrVocabsFile, 'utf8');
    const cefrVocabs = JSON.parse(cefrContent);
    
    console.log(`📊 Loaded ${cefrVocabs.length} CEFR vocab entries`);
    
    let updatedCount = 0;
    let addedCount = 0;
    
    // 각 CEFR 단어에 대해 수능 단어와 매칭 확인
    for (const vocab of cefrVocabs) {
        const lemmaLower = vocab.lemma.toLowerCase();
        
        if (suneungWords.has(lemmaLower)) {
            // levelCEFR 필드 확인 및 업데이트
            if (typeof vocab.levelCEFR === 'string') {
                // 문자열인 경우, "수능"이 없으면 추가
                if (!vocab.levelCEFR.includes('수능')) {
                    vocab.levelCEFR = vocab.levelCEFR + ', 수능';
                    updatedCount++;
                    console.log(`✅ Updated: "${vocab.lemma}" -> levelCEFR: "${vocab.levelCEFR}"`);
                }
            } else if (Array.isArray(vocab.levelCEFR)) {
                // 배열인 경우, "수능"이 없으면 추가
                if (!vocab.levelCEFR.includes('수능')) {
                    vocab.levelCEFR.push('수능');
                    updatedCount++;
                    console.log(`✅ Updated: "${vocab.lemma}" -> levelCEFR: ${JSON.stringify(vocab.levelCEFR)}`);
                }
            } else {
                // 다른 타입인 경우, 배열로 변경하고 "수능" 추가
                vocab.levelCEFR = [vocab.levelCEFR, '수능'];
                updatedCount++;
                console.log(`✅ Updated: "${vocab.lemma}" -> levelCEFR: ${JSON.stringify(vocab.levelCEFR)}`);
            }
            addedCount++;
        }
    }
    
    // 업데이트된 JSON 저장
    fs.writeFileSync(outputFile, JSON.stringify(cefrVocabs, null, 2), 'utf8');
    
    console.log(`\n📈 Processing Summary:`);
    console.log(`   Total CEFR entries: ${cefrVocabs.length}`);
    console.log(`   Total 수능 words: ${suneungWords.size}`);
    console.log(`   Matched words: ${addedCount}`);
    console.log(`   Updated entries: ${updatedCount}`);
    console.log(`   Match rate: ${((addedCount / suneungWords.size) * 100).toFixed(1)}%`);
    
    console.log(`\n✅ Success! Updated CEFR vocab file saved to: ${path.basename(outputFile)}`);
    console.log(`📁 File location: ${outputFile}`);
    
    // 매칭되지 않은 수능 단어들 샘플 출력
    const unmatchedWords = [];
    for (const word of suneungWords) {
        const found = cefrVocabs.some(vocab => vocab.lemma.toLowerCase() === word);
        if (!found) {
            unmatchedWords.push(word);
        }
    }
    
    if (unmatchedWords.length > 0) {
        console.log(`\n📝 Sample unmatched 수능 words (first 20):`);
        unmatchedWords.slice(0, 20).forEach((word, index) => {
            console.log(`   ${index + 1}. ${word}`);
        });
        console.log(`   ... and ${Math.max(0, unmatchedWords.length - 20)} more unmatched words`);
    }
    
} catch (error) {
    console.error('❌ Error updating CEFR vocabs:', error.message);
    process.exit(1);
}