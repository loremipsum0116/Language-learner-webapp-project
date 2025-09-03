// server/debug_cefr_update.js
// 수능완성_영단어만_중복제거.txt의 단어들이 cefr_vocabs.json에 있으면 levelCEFR에 "수능" 추가 (디버그 버전)

const fs = require('fs');
const path = require('path');

const suneungWordsFile = path.join(__dirname, '수능완성_영단어만_중복제거.txt');
const cefrVocabsFile = path.join(__dirname, 'cefr_vocabs.json');

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
    
    let matchedCount = 0;
    let alreadyHasSuneung = 0;
    let wouldUpdate = 0;
    
    // 각 CEFR 단어에 대해 수능 단어와 매칭 확인
    for (const vocab of cefrVocabs) {
        const lemmaLower = vocab.lemma.toLowerCase();
        
        if (suneungWords.has(lemmaLower)) {
            matchedCount++;
            
            // levelCEFR 필드 확인
            if (typeof vocab.levelCEFR === 'string') {
                if (vocab.levelCEFR.includes('수능')) {
                    alreadyHasSuneung++;
                    console.log(`⚠️  Already has 수능: "${vocab.lemma}" -> levelCEFR: "${vocab.levelCEFR}"`);
                } else {
                    wouldUpdate++;
                    if (wouldUpdate <= 10) {
                        console.log(`✅ Would update: "${vocab.lemma}" -> levelCEFR: "${vocab.levelCEFR}" to "${vocab.levelCEFR}, 수능"`);
                    }
                }
            } else if (Array.isArray(vocab.levelCEFR)) {
                if (vocab.levelCEFR.includes('수능')) {
                    alreadyHasSuneung++;
                    console.log(`⚠️  Already has 수능 (array): "${vocab.lemma}" -> levelCEFR: ${JSON.stringify(vocab.levelCEFR)}`);
                } else {
                    wouldUpdate++;
                    if (wouldUpdate <= 10) {
                        console.log(`✅ Would update (array): "${vocab.lemma}" -> levelCEFR: ${JSON.stringify(vocab.levelCEFR)} to add "수능"`);
                    }
                }
            } else {
                wouldUpdate++;
                if (wouldUpdate <= 10) {
                    console.log(`✅ Would convert: "${vocab.lemma}" -> levelCEFR: ${vocab.levelCEFR} to [${vocab.levelCEFR}, "수능"]`);
                }
            }
        }
    }
    
    console.log(`\n📈 Analysis Summary:`);
    console.log(`   Total CEFR entries: ${cefrVocabs.length}`);
    console.log(`   Total 수능 words: ${suneungWords.size}`);
    console.log(`   Matched words: ${matchedCount}`);
    console.log(`   Already have 수능: ${alreadyHasSuneung}`);
    console.log(`   Would be updated: ${wouldUpdate}`);
    console.log(`   Match rate: ${((matchedCount / suneungWords.size) * 100).toFixed(1)}%`);
    
    // 원본 파일에 이미 "수능"이 있는지 확인
    const originalHasSuneung = cefrContent.includes('수능');
    console.log(`\n🔍 Original file contains "수능": ${originalHasSuneung}`);
    
} catch (error) {
    console.error('❌ Error analyzing CEFR vocabs:', error.message);
    process.exit(1);
}