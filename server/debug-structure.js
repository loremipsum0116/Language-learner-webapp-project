// Debug the exact text structure
const testText = "however. 그러나 또는 하지만이라는 뜻입니다. He was feeling bad. However, he went to work.  그는 몸이 좋지 않았다. 하지만, 그는 일하러 갔다. 라는 의미네요.";

console.log('Full text:');
console.log(testText);
console.log('\nCharacter by character analysis around key sections:');

// Find key sections
const sections = testText.split('. ');
console.log('\nSplit by ". ":');
sections.forEach((section, i) => {
    console.log(`Section ${i}: "${section}"`);
});

// Look for the English part specifically
const englishStart = testText.indexOf('He was feeling bad');
if (englishStart > 0) {
    console.log(`\nEnglish starts at position ${englishStart}`);
    const englishSection = testText.substring(englishStart, englishStart + 100);
    console.log(`English section: "${englishSection}"`);
    
    // Check what comes after the English
    const afterEnglish = testText.substring(englishStart + 50);
    console.log(`After English: "${afterEnglish}"`);
}

// Try to manually extract the pattern
console.log('\nManual pattern matching:');
// Pattern: "He was feeling bad. However, he went to work."
const manualPattern = /(He was feeling bad\. However, he went to work\.)/;
const manualMatch = testText.match(manualPattern);
console.log('Manual match:', manualMatch ? manualMatch[1] : 'No match');

// Try broader pattern
const broadPattern = /(He[^라는]+work\.)/;
const broadMatch = testText.match(broadPattern);
console.log('Broad match:', broadMatch ? broadMatch[1] : 'No match');