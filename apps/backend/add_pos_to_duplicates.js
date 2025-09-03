// server/add_pos_to_duplicates.js
// cefr_vocabs_duplicates.json의 lemma에 품사 정보를 괄호로 추가

const fs = require('fs');
const path = require('path');

const inputFile = path.join(__dirname, 'cefr_vocabs_duplicates.json');
const outputFile = path.join(__dirname, 'cefr_vocabs_duplicates_with_pos.json');

// 품사 약어 매핑
const posAbbreviations = {
    'noun': 'n',
    'verb': 'v',
    'adjective': 'adj',
    'adverb': 'adv',
    'preposition': 'prep',
    'pronoun': 'pron',
    'conjunction': 'conj',
    'interjection': 'int',
    'determiner': 'det',
    'article': 'art',
    'auxiliary verb': 'aux',
    'modal verb': 'modal',
    'phrasal verb': 'phrasal v',
    'indefinite article': 'art',
    'definite article': 'art',
    'possessive pronoun': 'pron',
    'personal pronoun': 'pron',
    'demonstrative pronoun': 'pron',
    'interrogative pronoun': 'pron',
    'relative pronoun': 'pron',
    'reflexive pronoun': 'pron',
    'coordinating conjunction': 'conj',
    'subordinating conjunction': 'conj'
};

function getPosAbbreviation(pos) {
    // 품사를 소문자로 변환하고 정리
    const cleanPos = pos.toLowerCase().trim();
    
    // 여러 품사가 콤마나 다른 구분자로 나뉘어 있는 경우 첫 번째만 사용
    const firstPos = cleanPos.split(/[,&/]/)[0].trim();
    
    // 매핑에서 찾기
    if (posAbbreviations[firstPos]) {
        return posAbbreviations[firstPos];
    }
    
    // 직접 매치되지 않는 경우 일부 패턴 매칭
    if (firstPos.includes('noun')) return 'n';
    if (firstPos.includes('verb')) return 'v';
    if (firstPos.includes('adjective')) return 'adj';
    if (firstPos.includes('adverb')) return 'adv';
    if (firstPos.includes('preposition')) return 'prep';
    if (firstPos.includes('pronoun')) return 'pron';
    if (firstPos.includes('conjunction')) return 'conj';
    if (firstPos.includes('article')) return 'art';
    
    // 매치되지 않는 경우 원본 그대로 사용 (앞 5글자까지)
    return firstPos.substring(0, 5);
}

try {
    console.log('🔍 Reading cefr_vocabs_duplicates.json...');
    
    // JSON 파일 읽기
    const rawData = fs.readFileSync(inputFile, 'utf8');
    const vocabs = JSON.parse(rawData);
    
    console.log(`📊 Total duplicate entries: ${vocabs.length}`);
    
    // 각 단어에 품사 정보 추가
    const modifiedVocabs = vocabs.map(vocab => {
        const posAbbrev = getPosAbbreviation(vocab.pos);
        
        return {
            ...vocab,
            lemma: `${vocab.lemma} (${posAbbrev})`
        };
    });
    
    // 수정된 데이터 저장
    fs.writeFileSync(outputFile, JSON.stringify(modifiedVocabs, null, 2), 'utf8');
    
    console.log(`\n📈 Processing complete:`);
    console.log(`   Total entries processed: ${modifiedVocabs.length}`);
    
    // 품사별 통계 출력
    const posStats = {};
    modifiedVocabs.forEach(vocab => {
        const posMatch = vocab.lemma.match(/\(([^)]+)\)$/);
        if (posMatch) {
            const pos = posMatch[1];
            posStats[pos] = (posStats[pos] || 0) + 1;
        }
    });
    
    console.log(`\n📚 Entries by part of speech:`);
    Object.keys(posStats).sort().forEach(pos => {
        console.log(`   ${pos}: ${posStats[pos]} entries`);
    });
    
    // 수정 예시 출력
    console.log(`\n📝 Sample modifications:`);
    for (let i = 0; i < Math.min(5, modifiedVocabs.length); i++) {
        const original = vocabs[i].lemma;
        const modified = modifiedVocabs[i].lemma;
        const pos = vocabs[i].pos;
        console.log(`   "${original}" (${pos}) → "${modified}"`);
    }
    
    console.log(`\n✅ Success! Modified vocabulary saved to: ${path.basename(outputFile)}`);
    console.log(`📁 File location: ${outputFile}`);
    
} catch (error) {
    console.error('❌ Error processing file:', error.message);
    process.exit(1);
}