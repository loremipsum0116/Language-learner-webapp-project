// Test exclamation patterns
const testTexts = [
    "fire. 불이라는 뜻입니다. The house is on fire!  집에 불이 났다! 라는 의미네요.",
    "look. 보다라는 뜻입니다. Look at that beautiful sunset!  저 아름다운 일몰을 봐! 라는 의미네요.",
    "morning. 아침 또는 오전이라는 뜻입니다. Good morning!  좋은 아침! 이라는 의미네요."
];

console.log('Testing exclamation patterns...\n');

// Try different patterns specifically for exclamation cases
const patterns = [
    /([A-Z][^!]+!)\s+[가-힣][^!]*!\s+라는 의미네요/,    // Korean also ends with !
    /([A-Z][^!]+!)\s+[가-힣][^!]*!\s+이라는 의미네요/,   // Korean ends with ! + 이라는
    /([A-Z][^!]+!)\s+[가-힣][^.]*\.\s+라는 의미네요/,    // Korean ends with .
];

testTexts.forEach((testText, t) => {
    console.log(`Testing text ${t + 1}: ${testText.substring(0, 60)}...`);
    
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
    }
    console.log('');
});