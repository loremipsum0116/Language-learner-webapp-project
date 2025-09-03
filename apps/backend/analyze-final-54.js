// Analyze the specific patterns of the final 54 failed words
const testTexts = [
    // 복잡한 문장들 (세미콜론, 복수 문장)
    "however. 그러나 또는 하지만이라는 뜻입니다. He was feeling bad. However, he went to work.  그는 몸이 좋지 않았다. 하지만, 그는 일하러 갔다. 라는 의미네요.",
    
    // 숫자 관련
    "hundred. 100 또는 백이라는 뜻입니다. There are one hundred cents in a dollar.  1달러는 100센트이다. 라는 의미네요.",
    
    // 대화형 (따옴표)
    "certainly. 틀림없이 또는 물론 이라는 뜻입니다. \"Could you help me?\" \"Certainly.\" \"좀 도와주시겠어요?\" \"물론이죠.\" 라는 의미네요.",
    
    // 간단한 케이스
    "o'clock. 정각을 나타낼 때 쓰는 말입니다. Its three oclock.  3시 정각이다. 라는 의미네요.",
    
    // 이라는 의미네요 케이스  
    "of. 무엇무엇의 라는 뜻으로, 소유나 소속을 나타냅니다. A piece of cake.  케이크 한 조각. 이라는 의미네요.",
    
    // 세미콜론 케이스
    "moreover. 게다가 또는 더욱이 라는 뜻입니다. The car is old and rusty; moreover, the engine is unreliable. 그 차는 낡고 녹슬었다. 게다가 엔진도 신뢰할 수 없다. 라는 의미네요.",
    
    // 따옴표 + 복잡한 케이스
    "classic. 고전적인 또는 전형적인 이라는 뜻입니다. 'Moby Dick' is a classic American novel. '모비딕'은 고전적인 미국 소설이다. 라는 의미네요."
];

console.log('Analyzing final 54 failed patterns...\n');

// 새로운 고급 패턴들
const advancedPatterns = [
    // 대화 형태 ("..." "...")
    /("[^"]*")\s+[가-힣][^.]*\.\s+라는 의미네요/,
    /("Could[^"]*")\s+"[^"]*"\s+"[^"]*"\s+"[^"]*"\s+라는 의미네요/,
    
    // 세미콜론을 포함한 복합문 처리
    /([A-Z][^;]+;[^.]+\.)\s+[가-힣][^.]*\.\s+라는 의미네요/,
    
    // 복수 문장 (첫 번째 문장만)
    /([A-Z][^.]+\.)\s+[A-Z][^.]+\.\s+[가-힣][^.]*\.\s+라는 의미네요/,
    
    // Its (아포스트로피) 처리
    /(Its[^.]+\.)\s+[가-힣][^.]*\.\s+라는 의미네요/,
    
    // 간단한 문장 (A piece of cake)
    /([A-Z][^.]+\.)\s+[가-힣][^.]*\.\s+이라는 의미네요/,
    
    // 따옴표가 포함된 복잡한 문장
    /('[^']+')[^.]*\.\s+[가-힣][^.]*\.\s+라는 의미네요/,
    
    // 숫자가 포함된 문장
    /([A-Z][^.]*\d[^.]*\.)\s+[가-힣][^.]*\.\s+라는 의미네요/,
    
    // 일반적인 마지막 시도 - 매우 넓은 패턴
    /([A-Z][A-Za-z\s0-9',;!?.-]+[.!?])\s+[가-힣][^.]*\.\s+(?:라는|이라는) 의미네요/,
];

testTexts.forEach((testText, t) => {
    console.log(`Testing text ${t + 1}:`);
    console.log(testText.substring(0, 80) + '...\n');
    
    let foundMatch = false;
    advancedPatterns.forEach((pattern, i) => {
        const match = testText.match(pattern);
        if (match) {
            console.log(`  ✅ Pattern ${i + 1} matched: "${match[1]}"`);
            foundMatch = true;
        }
    });
    
    if (!foundMatch) {
        console.log('  ❌ No pattern matched');
        
        // Manual analysis
        console.log('  Manual analysis:');
        const parts = testText.split('. ');
        if (parts.length > 2) {
            const englishPart = parts.slice(1).join('. ').split('  ')[0];
            console.log(`  Potential extract: "${englishPart}"`);
        }
    }
    console.log('-'.repeat(50));
});