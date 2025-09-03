// Test the new comprehensive patterns
const testTexts = [
    "however. 그러나 또는 하지만이라는 뜻입니다. He was feeling bad. However, he went to work.  그는 몸이 좋지 않았다. 하지만, 그는 일하러 갔다. 라는 의미네요.",
    "hundred. 100 또는 백이라는 뜻입니다. There are one hundred cents in a dollar.  1달러는 100센트이다. 라는 의미네요.",
    "o'clock. 정각을 나타낼 때 쓰는 말입니다. Its three oclock.  3시 정각이다. 라는 의미네요.",
    "moreover. 게다가 또는 더욱이 라는 뜻입니다. The car is old and rusty; moreover, the engine is unreliable. 그 차는 낡고 녹슬었다. 게다가 엔진도 신뢰할 수 없다. 라는 의미네요.",
    "classic. 고전적인 또는 전형적인 이라는 뜻입니다. 'Moby Dick' is a classic American novel. '모비딕'은 고전적인 미국 소설이다. 라는 의미네요."
];

// 새로 추가한 패턴들
const newPatterns = [
    // 복수 영어 문장 처리
    /([A-Z][^.]+\.)\s+[A-Z][^.]+\.\s+[가-힣][^.]*\.\s+라는 의미네요/,
    
    // 세미콜론이 포함된 복합문 처리
    /([A-Z][^;]+;[^.]+\.)\s+[가-힣][^.]*\.\s+라는 의미네요/,
    
    // Its 케이스
    /(Its[^.]+\.)\s+[가-힣][^.]*\.\s+라는 의미네요/,
    
    // 따옴표가 포함된 문장
    /('[^']+')[^.]*\.\s+[가-힣][^.]*\.\s+라는 의미네요/,
    
    // 최후의 수단 - 매우 포괄적인 패턴
    /([A-Z][A-Za-z\s0-9',;!?.()\[\]-]+[.!?])\s+[가-힣][^.]*\.\s+(?:라는|이라는) 의미네요/,
];

console.log('Testing new comprehensive patterns...\n');

testTexts.forEach((testText, t) => {
    console.log(`Testing text ${t + 1}:`);
    console.log(testText.substring(0, 70) + '...\n');
    
    let foundMatch = false;
    newPatterns.forEach((pattern, i) => {
        const match = testText.match(pattern);
        if (match) {
            console.log(`  ✅ Pattern ${i + 1} matched: "${match[1]}"`);
            foundMatch = true;
        }
    });
    
    if (!foundMatch) {
        console.log('  ❌ No pattern matched');
    }
    console.log('-'.repeat(50));
});