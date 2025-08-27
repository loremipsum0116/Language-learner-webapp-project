// Test specific case
const testText = "breakfast. 아침 식사라는 뜻입니다. What did you have for breakfast?  아침으로 무엇을 드셨어요? 라는 의미네요.";

console.log('Full text:', testText);
console.log('');

// Try different patterns specifically for this case
const patterns = [
    /([A-Z][^?]+\?)\s+[가-힣][^?]*\?\s+라는 의미네요/,    // Korean also ends with ?
    /([A-Z][^?]+\?)\s+[가-힣][^.]*\.\s+라는 의미네요/,    // Korean ends with .  
    /([A-Z][^?]+\?)\s*\s+[가-힣][^.]*\?\s+라는 의미네요/, // Handle multiple spaces
];

patterns.forEach((pattern, i) => {
    const match = testText.match(pattern);
    console.log(`Pattern ${i + 1}: ${pattern}`);
    console.log(`Match: ${match ? `"${match[1]}"` : 'No match'}`);
    console.log('---');
});