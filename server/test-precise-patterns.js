// Test precise patterns for the remaining cases
const testTexts = [
    "however. 그러나 또는 하지만이라는 뜻입니다. He was feeling bad. However, he went to work.  그는 몸이 좋지 않았다. 하지만, 그는 일하러 갔다. 라는 의미네요.",
    "hundred. 100 또는 백이라는 뜻입니다. There are one hundred cents in a dollar.  1달러는 100센트이다. 라는 의미네요.",
    "o'clock. 정각을 나타낼 때 쓰는 말입니다. Its three oclock.  3시 정각이다. 라는 의미네요.",
    "moreover. 게다가 또는 더욱이 라는 뜻입니다. The car is old and rusty; moreover, the engine is unreliable. 그 차는 낡고 녹슬었다. 게다가 엔진도 신뢰할 수 없다. 라는 의미네요."
];

// 매우 정확한 패턴들
const precisePatterns = [
    // 복수 영어 문장 - 전체 영어 블록 추출
    /(He was feeling bad\. However, he went to work\.)/,  // however 케이스
    /(There are one hundred cents in a dollar\.)/,        // hundred 케이스  
    /(Its three oclock\.)/,                               // o'clock 케이스
    /(The car is old and rusty; moreover, the engine is unreliable\.)/,  // moreover 케이스
    
    // 더 일반적인 패턴들
    /([A-Z][^.]*; [^.]*\.)\s+[가-힣]/,                    // 세미콜론 패턴
    /([A-Z][^.]*\. [A-Z][^.]*\.)\s+[가-힣]/,             // 두 문장 패턴
    /(Its[^.]*\.)\s+[가-힣]/,                             // Its 패턴
    /([A-Z][^.]*cents[^.]*\.)\s+[가-힣]/,                 // 숫자/단위 포함 패턴
    
    // 최종 광범위 패턴
    /([A-Z][A-Za-z\s0-9',;!?()-]+\.)\s+[가-힣][^.]*\.\s+라는 의미네요/,
];

console.log('Testing precise patterns...\n');

testTexts.forEach((testText, t) => {
    console.log(`Testing text ${t + 1}:`);
    console.log(testText.substring(0, 60) + '...\n');
    
    let foundMatch = false;
    precisePatterns.forEach((pattern, i) => {
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