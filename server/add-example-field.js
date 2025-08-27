// server/add-example-field.js
// cefr_vocabs.json에 example 필드 추가

const fs = require('fs');
const path = require('path');

// 영어 예문 추출 함수
function extractEnglishExample(chirpScript) {
    if (!chirpScript) return '';
    
    // 패턴들을 순서대로 시도 (더 포괄적으로 수정)
    const patterns = [
        // 기본 패턴들
        /예문은 (.+?)이고/,
        /([A-Z][^?!.]*[?!.]) [가-힣].+ 와 같이 사용됩니다/,
        /([A-Z][^?!.]*[?!.]) [가-힣].+ 라는 뜻입니다/,
        /([A-Z][^.!?]*[.!?]) 처럼/,
        /([A-Z][^.!?]*[.!?])은 [가-힣]/,
        /([A-Z][^?]*\?) 라고/,
        
        // 실패한 케이스들을 위한 패턴 추가 (문장 중간에 있는 영어문장)
        /([A-Z][^.]+\.)\s+[가-힣][^.]*\.\s+라는 의미네요/,    // "영어문장. 한국어번역. 라는 의미네요"
        /([A-Z][^.]+\.)\s+[가-힣][^.]*\.\s+라는 뜻입니다/,     // "영어문장. 한국어번역. 라는 뜻입니다" 
        /([A-Z][^.]+\.)\s+[가-힣][^.]*\.\s+라는 의미입니다/,    // "영어문장. 한국어번역. 라는 의미입니다"
        /([A-Z][^.!?]*[.!?])\.\s+[^.]*\.\s+라는 의미네요/,  // 기존 패턴도 유지
        /([A-Z][^.!?]*[.!?])\.\s+[^.]*\.\s+라는 뜻입니다/,   
        /([A-Z][^.!?]*[.!?])\.\s+[^.]*\.\s+라는 의미입니다/,
        
        // 물음표로 끝나는 영어 문장들을 위한 새로운 패턴들 (한국어 번역도 ?로 끝남)
        /([A-Z][^?]+\?)\s+[가-힣][^?]*\?\s+라는 의미네요/,    // "영어문장? 한국어번역? 라는 의미네요"
        /([A-Z][^?]+\?)\s+[가-힣][^?]*\?\s+라는 뜻입니다/,     // "영어문장? 한국어번역? 라는 뜻입니다" 
        /([A-Z][^?]+\?)\s+[가-힣][^?]*\?\s+라는 의미입니다/,    // "영어문장? 한국어번역? 라는 의미입니다"
        
        // 느낌표로 끝나는 영어 문장들을 위한 패턴들
        /([A-Z][^!]+!)\s+[가-힣][^!]*!\s+라는 의미네요/,    // "영어문장! 한국어번역! 라는 의미네요"
        /([A-Z][^!]+!)\s+[가-힣][^!]*!\s+이라는 의미네요/,   // "영어문장! 한국어번역! 이라는 의미네요"
        /([A-Z][^!]+!)\s+[가-힣][^.]*\.\s+라는 의미네요/,    // "영어문장! 한국어번역. 라는 의미네요"
        
        // 마침표로 끝나는 영어 + 다양한 구두점으로 끝나는 한국어 (남은 케이스들)
        /([A-Z][^.]+\.)\s+[가-힣][^.]*\?\s+라는 의미네요/,    // "영어문장. 한국어번역? 라는 의미네요"  
        /([A-Z][^.]+\.)\s+[가-힣][^.]*\.\s+라는 의미네요/,    // "영어문장. 한국어번역. 라는 의미네요"
        /([A-Z][^.]+\.)\s+[가-힣][^.]*\.\s+라는 뜻입니다/,     // "영어문장. 한국어번역. 라는 뜻입니다"
        
        // 시간 표현이 포함된 패턴들 (a.m., p.m. 등)
        /([A-Z][^.]*[ap]\.m\.)\s+[가-힣][^.]*\.\s+라는 의미네요/,    // "시간 표현을 포함한 영어문장"
        
        // 숫자나 특수 표현들
        /([A-Z][^.]*\d[^.]*\.)\s+[가-힣][^.]*\.\s+라는 의미네요/,     // 숫자 포함
        /('[^']*'[^.]*\.)\s+[가-힣][^.]*\.\s+라는 의미네요/,          // 따옴표 포함
        
        // 여러 영어 예문이 있는 경우를 위한 패턴들 (첫 번째만 추출)
        /([A-Z][^.!?]*[.!?])\s+[^.]*\.\s+([A-Z][^.!?]*[.!?])\s+[^.]*\.\s+라는 의미네요/,  // 두 번째 문장 추출
        /([A-Z][^?]+\?)\s+[^.]*\.\s+([A-Z][^?]+\?)\s+[^.]*\.\s+라는 의미네요/,  // 두 번째 물음표 문장
        
        // 더 포괄적인 패턴들 (기존)
        /([A-Z][^.!?]*[.!?])\. 이 문장은 [^.]*라는 의미입니다/,
        /([A-Z][^.!?]*[.!?])\. [^.]*와 같이 사용해요/,
        /([A-Z][^.!?]*[.!?])\. [^.]*처럼 쓸 수 있습니다/,
        /([A-Z][^.!?]*[.!?])\. [^.]*라는 예문처럼 사용됩니다/,
        /([A-Z][^.!?]*[.!?])\. [^.]*와 같이 말할 수 있어요/,
        
        // 특정 복잡한 케이스들 (정확한 매칭)
        /(He was feeling bad\. However, he went to work\.)/,               // however 케이스
        /(There are one hundred cents in a dollar\.)/,                     // hundred 케이스  
        /(Its three oclock\.)/,                                            // o'clock 케이스
        /(The car is old and rusty; moreover, the engine is unreliable\.)/, // moreover 케이스
        
        // 복수 영어 문장 처리 - 전체 영어 블록 추출  
        /([A-Z][^.]*\. [A-Z][^.]*\.)\s+[가-힣]/,                          // 두 문장 패턴 (일반)
        /([A-Z][^;]*; [^.]*\.)\s+[가-힣]/,                                // 세미콜론 패턴 (일반)
        
        // 특수 케이스들
        /(Its[^.]*\.)\s+[가-힣]/,                                          // Its 패턴
        /([A-Z][^.]*cents[^.]*\.)\s+[가-힣]/,                             // 숫자/단위 포함
        /([A-Z][^.]*seconds[^.]*\.)\s+[가-힣]/,                           // seconds 포함
        /([A-Z][^.]*months[^.]*\.)\s+[가-힣]/,                            // months 포함
        /([A-Z][^.]*days[^.]*\.)\s+[가-힣]/,                              // days 포함
        /([A-Z][^.]*page[^.]*\.)\s+[가-힣]/,                              // page 포함
        
        // 대화형 패턴들 (따옴표 처리)
        /("[^"]*"[^"]*"[^.]*\.)\s+[가-힣][^.]*\.\s+라는 의미네요/,         // 두 개의 따옴표가 있는 대화
        /("[^"]*"\s+"[^"]*")\s+[가-힣][^.]*\.\s+라는 의미네요/,           // "질문" "대답" 형태
        /("[^"]*")\s+[가-힣][^.]*\.\s+라는 의미네요/,                      // 하나의 따옴표
        
        // 따옴표가 포함된 문장 (책 제목 등)
        /('[^']+')[^.]*\.\s+[가-힣][^.]*\.\s+라는 의미네요/,              // '제목' 형태
        /('[^']+' is[^.]*\.)\s+[가-힣]/,                                   // '제목' is ... 형태
        
        // 이라는 의미네요 케이스들
        /([A-Z][^.]+\.)\s+[가-힣][^.]*\.\s+이라는 의미네요/,               // 일반 케이스
        
        // 수학/문법 용어 특수 케이스
        /([A-Z][^.]*synonym[^.]*\.)/,                                      // synonym 케이스
        /([A-Z][^.]*antonym[^.]*\.)/,                                      // antonym 케이스
        /([A-Z][^.]*syllable[^.]*\.)/,                                     // syllable 케이스
        /([A-Z][^.]*noun\.)/,                                              // noun 케이스
        /([A-Z][^.]*plural[^.]*\.)/,                                       // plural 케이스
        /([A-Z][^.]*factorial[^.]*\.)/,                                    // factorial 케이스
        /([A-Z][^.]*minus[^.]*\.)/,                                        // minus 케이스
        /([A-Z][^.]*plus[^.]*\.)/,                                         // plus 케이스
        
        // 최종 35개 단어를 위한 특화 패턴들
        
        // 대화형 - 정확한 매칭
        /("Are you coming\?" "Yeah\.")/,                                   // yeah 케이스
        /("Could you help me\?" "Certainly\.")/,                          // certainly 케이스  
        /("Are you ready\?" "Yes, I am\.")/,                              // yes 케이스
        
        // 일반적인 대화형 패턴  
        /("[^"]*\?" "[^"]*\.")/,                                          // 일반 대화형
        
        // 축약형/약어 정확한 패턴
        /('USA' is an abbreviation for 'United States of America'\.)/,    // abbreviation
        /('Don't' is a contraction of 'do not'\.)/,                       // contraction
        /('Mister' is abbreviated to 'Mr\.'\.)/,                          // abbreviate
        /('The Lord of the Rings' is a famous trilogy\.)/,                // trilogy
        /('Coca-Cola' is a registered trademark\.)/,                      // trademark
        /('Moby Dick' is a classic American novel\.)/,                    // classic
        /('The world is a stage' is a well-known metaphor\.)/,            // metaphor
        /('Look before you leap' is a famous proverb\.)/,                 // proverb
        /('My heart is broken' is a figurative expression\.)/,            // figurative
        
        // 일반적인 따옴표 패턴
        /('[^']*' is[^.]*\.)/,                                            // '...' is 패턴
        
        // 숫자 포함 특정 패턴들
        /(There are \d+[^.]*\.)/,                                         // There are 숫자
        /(The value of[^.]*\.)/,                                          // The value of
        /(There are sixty seconds in a minute\.)/,                        // second
        /(There are twelve months in a year\.)/,                          // month/twelve
        /(There are thirty days in April\.)/,                             // thirty  
        /(There are 365 days in a year\.)/,                               // year
        /(Its a quarter past three\.)/,                                   // quarter
        /(Please turn to page 10\.)/,                                     // page
        /(Please read the text on page 20\.)/,                            // text
        /(Read the first column on page two\.)/,                          // column
        /(I usually wake up at 7 a\.m\.)/,                                // usually
        /(Can you define the word 'love'\?)/,                             // define
        /(It's polite to say 'thank you'\.)/,                             // polite
        /(Children under 12 must accompany an adult\.)/,                  // accompany
        /(Education is compulsory for children between the ages of 6 and 16\.)/,  // compulsory
        /(The word 'politics' is derived from a Greek word\.)/,           // derive
        /(The word 'home' often connotes warmth and security\.)/,         // connote
        /(The word 'home' often has connotations of warmth and security\.)/,  // connotation
        /(It has rained for four consecutive days\.)/,                    // consecutive
        /(Only people over 18 are eligible to vote\.)/,                   // eligible
        /(A trio of singers performed at the event\.)/,                   // trio
        /(If you subtract 4 from 10, you get 6\.)/,                       // subtract
        /('And' and 'but' are common conjunctions\.)/,                    // conjunction
        
        // 가장 일반적인 패턴 - 영어문장 후 한국어가 바로 오는 경우
        /([A-Z][A-Za-z\s',!?.-]+[.!?]) [가-힣]/,
        
        // 최후의 수단 - 매우 포괄적인 패턴
        /([A-Z][A-Za-z\s0-9',;!?.()\[\]-]+[.!?])\s+[가-힣][^.]*\.\s+(?:라는|이라는) 의미네요/,
    ];
    
    for (const pattern of patterns) {
        const match = chirpScript.match(pattern);
        if (match) {
            // For patterns with multiple captures, prefer the second capture (more likely to be the actual example)
            if (match[2]) {
                return match[2].trim();
            }
            return match[1].trim();
        }
    }
    
    return '';
}

async function addExampleField() {
    try {
        console.log('📚 Loading cefr_vocabs.json...');
        
        const filePath = path.join(__dirname, 'cefr_vocabs.json');
        const cefrData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        
        console.log(`📝 Processing ${cefrData.length} vocabulary items...`);
        
        let extractedCount = 0;
        let noExampleCount = 0;
        
        // 각 단어에 example 필드 추가
        for (let i = 0; i < cefrData.length; i++) {
            const vocab = cefrData[i];
            const englishExample = extractEnglishExample(vocab.koChirpScript);
            
            if (englishExample) {
                vocab.example = englishExample;
                extractedCount++;
                
                if ((i + 1) % 100 === 0) {
                    console.log(`   Processed: ${i + 1}/${cefrData.length} (${extractedCount} extracted)`);
                }
            } else {
                vocab.example = '';
                noExampleCount++;
            }
        }
        
        console.log('💾 Saving updated cefr_vocabs.json...');
        
        // 백업 생성
        const backupPath = path.join(__dirname, 'cefr_vocabs.backup.json');
        fs.writeFileSync(backupPath, fs.readFileSync(filePath));
        console.log('✅ Backup saved to cefr_vocabs.backup.json');
        
        // 업데이트된 파일 저장
        fs.writeFileSync(filePath, JSON.stringify(cefrData, null, 2));
        
        console.log('🎉 Example field addition completed!');
        console.log(`   Total items: ${cefrData.length}`);
        console.log(`   Extracted examples: ${extractedCount}`);
        console.log(`   No examples: ${noExampleCount}`);
        console.log(`   Success rate: ${Math.round((extractedCount / cefrData.length) * 100)}%`);
        
        // 몇 개 샘플 출력
        console.log('\n📖 Sample results:');
        for (let i = 0; i < Math.min(10, cefrData.length); i++) {
            const vocab = cefrData[i];
            console.log(`   ${vocab.lemma}: ${vocab.example ? '✅ ' + vocab.example : '❌ (없음)'}`);
        }
        
    } catch (error) {
        console.error('❌ Error adding example field:', error);
        process.exit(1);
    }
}

// 실행
if (require.main === module) {
    addExampleField();
}

module.exports = { addExampleField };