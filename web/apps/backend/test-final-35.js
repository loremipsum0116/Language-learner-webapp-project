// Test patterns for the final 35 words
const testTexts = [
    // 대화형
    "yeah. '응' 또는 '그래' 라는 뜻으로, yes의 비격식적인 표현입니다. \"Are you coming?\" \"Yeah.\" \"올 거니?\" \"응.\" 라는 의미네요.",
    "certainly. 틀림없이 또는 물론 이라는 뜻입니다. \"Could you help me?\" \"Certainly.\" \"좀 도와주시겠어요?\" \"물론이죠.\" 라는 의미네요.",
    
    // 약어/축약형
    "abbreviation. 약어라는 뜻입니다. 'USA' is an abbreviation for 'United States of America'. 'USA'는 'United States of America'의 약어이다. 라는 의미네요.",
    "contraction. 수축 또는 축약형이라는 뜻입니다. 'Don't' is a contraction of 'do not'. 'Don't'는 'do not'의 축약형이다. 라는 의미네요.",
    
    // 숫자가 포함된 단순한 케이스들
    "year. 년 또는 해 라는 뜻입니다. There are 365 days in a year. 1년은 365일이다. 라는 의미네요.",
    "pi. 원주율 파이라는 뜻입니다. The value of pi is approximately 3.14. 파이의 값은 약 3.14이다. 라는 의미네요."
];

// 최종 특화 패턴들
const finalPatterns = [
    // 대화형 - 두 개의 따옴표
    /("Are you coming\?" "Yeah\.")/,
    /("Could you help me\?" "Certainly\.")/,
    /("Are you ready\?" "Yes, I am\.")/,
    
    // 일반적인 대화형 패턴  
    /("[^"]*\?" "[^"]*\.")/,
    
    // 축약형/약어 패턴
    /('USA' is an abbreviation for 'United States of America'\.)/,
    /('Don't' is a contraction of 'do not'\.)/,
    /('Mister' is abbreviated to 'Mr\.'\.)/,
    
    // 일반적인 따옴표 패턴
    /('[^']*' is[^.]*\.)/,
    
    // 숫자 포함 간단한 패턴
    /(There are \d+[^.]*\.)/,
    /(The value of[^.]*\.)/,
    
    // 매우 일반적인 패턴
    /([A-Z][^.]*\d[^.]*\.)\s+[가-힣]/,
    /([A-Z][^.]*[Aa]pril[^.]*\.)\s+[가-힣]/,
    /([A-Z][^.]*page[^.]*\.)\s+[가-힣]/,
    /([A-Z][^.]*quarter[^.]*\.)\s+[가-힣]/,
    
    // 최종 광범위 패턴
    /([A-Z][A-Za-z\s0-9',;!?()\[\].-]+[.!?])\s+[가-힣][^.]*\.\s+라는 의미네요/,
];

console.log('Testing patterns for final 35 words...\n');

testTexts.forEach((testText, t) => {
    console.log(`Testing text ${t + 1}:`);
    console.log(testText.substring(0, 70) + '...\n');
    
    let foundMatch = false;
    finalPatterns.forEach((pattern, i) => {
        const match = testText.match(pattern);
        if (match) {
            console.log(`  ✅ Pattern ${i + 1} matched: "${match[1]}"`);
            foundMatch = true;
        }
    });
    
    if (!foundMatch) {
        console.log('  ❌ No pattern matched');
    }
    console.log('-'.repeat(70));
});