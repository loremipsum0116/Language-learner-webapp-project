// server/test-regex.js
// 정규표현식 테스트

const testTexts = [
    "box. 상자라는 뜻입니다. He put the books in a cardboard box.  그는 책들을 판지 상자에 넣었다. 라는 의미네요.",
    "breakfast. 아침 식사라는 뜻입니다. What did you have for breakfast?  아침으로 무엇을 드셨어요? 라는 의미네요.",
    "butter. 버터라는 뜻입니다. Please pass the butter.  버터 좀 건네주시겠어요? 라는 의미네요.",
];

const patterns = [
    // 물음표로 끝나는 영어 문장들을 위한 새로운 패턴들 (여러 공백 처리)
    /([A-Z][^?]+\?)\s+[가-힣][^.]*\.\s+라는 의미네요/,    // "영어문장? 한국어번역. 라는 의미네요"
    /([A-Z][^?]+\?)\s+[가-힣][^.]*\.\s+라는 뜻입니다/,     // "영어문장? 한국어번역. 라는 뜻입니다" 
    /([A-Z][^?]+\?)\s+[가-힣][^.]*\.\s+라는 의미입니다/,    // "영어문장? 한국어번역. 라는 의미입니다"
    
    // 마침표로 끝나는 기존 패턴들
    /([A-Z][^.]+\.)\s+[가-힣][^.]*\.\s+라는 의미네요/,    // "영어문장. 한국어번역. 라는 의미네요"
    /([A-Z][^.]+\.)\s+[가-힣][^.]*\.\s+라는 뜻입니다/,     // "영어문장. 한국어번역. 라는 뜻입니다" 
];

// Test all texts against all patterns
for (let t = 0; t < testTexts.length; t++) {
    const testText = testTexts[t];
    console.log(`\nTesting text ${t + 1}:`, testText);
    console.log('Raw bytes:', [...testText].slice(30, 80).map(c => `${c}(${c.charCodeAt(0)})`).join(' '));
    
    let foundMatch = false;
    for (let i = 0; i < patterns.length; i++) {
        const match = testText.match(patterns[i]);
        if (match) {
            console.log(`  ✅ Pattern ${i + 1} matched: "${match[1]}"`);
            foundMatch = true;
            break;
        }
    }
    
    if (!foundMatch) {
        console.log('  ❌ No pattern matched');
        // Try to find the question mark manually
        const qIndex = testText.indexOf('?');
        if (qIndex > 0) {
            console.log('  Found "?" at position', qIndex);
            console.log('  Context:', testText.substring(qIndex-10, qIndex+20));
        }
    }
}