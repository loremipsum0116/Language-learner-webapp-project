// Test final patterns for remaining failed words
const testTexts = [
    "butter. 버터라는 뜻입니다. Please pass the butter.  버터 좀 건네주시겠어요? 라는 의미네요.",
    "class. 수업 또는 학급이라는 뜻입니다. I have an English class at 10 a.m.  나는 오전 10시에 영어 수업이 있다. 라는 의미네요.",
    "meeting. 회의라는 뜻입니다. I have a meeting at 3 p.m.  나는 오후 3시에 회의가 있다. 라는 의미네요.",
    "plus. 무엇무엇을 더한 이라는 뜻입니다. Two plus two equals four. 2 더하기 2는 4이다. 라는 의미네요."
];

console.log('Testing final patterns...\n');

// Final comprehensive patterns
const patterns = [
    // 시간 표현 패턴 (a.m., p.m.)
    /([A-Z][^.]*[ap]\.m\.)\s+[가-힣][^.]*\.\s+라는 의미네요/,
    
    // 마침표 + 마침표 패턴
    /([A-Z][^.]+\.)\s+[가-힣][^.]*\.\s+라는 의미네요/,
    
    // 숫자 포함 패턴
    /([A-Z][^.]*\d[^.]*\.)\s+[가-힣][^.]*\.\s+라는 의미네요/,
    
    // 단순 패턴들 (구두점 무시)
    /([A-Z][A-Za-z\s',!?.\d-]+[.!?])\s+[가-힣][^.]*\.\s+라는 의미네요/,
    
    // 따옴표 패턴
    /('[^']*'[^.]*\.)\s+[가-힣][^.]*\.\s+라는 의미네요/,
];

testTexts.forEach((testText, t) => {
    console.log(`Testing text ${t + 1}:`);
    console.log(testText.substring(0, 80) + '...');
    
    let foundMatch = false;
    patterns.forEach((pattern, i) => {
        const match = testText.match(pattern);
        if (match) {
            console.log(`  ✅ Pattern ${i + 1} matched: "${match[1]}"`);
            foundMatch = true;
        }
    });
    
    if (!foundMatch) {
        console.log('  ❌ No pattern matched');
        // Try manual inspection
        const englishStart = testText.indexOf('. ') + 2;
        const sections = testText.substring(englishStart).split('. ');
        if (sections.length >= 2) {
            console.log('  Manual extract attempt:', sections[0]);
        }
    }
    console.log('');
});