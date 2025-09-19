// Read and parse the files to extract actual Japanese vocabulary
const fs = require('fs');

// Function to extract Japanese words from text
function extractJapaneseWords(content) {
    const words = new Set();
    const lines = content.split('\n');

    for (const line of lines) {
        // Skip comment lines and headers
        if (line.startsWith('→') || line.includes('====') || line.includes('제거된') || line.includes('중복') || line.includes('목록') || line.includes('================')) {
            continue;
        }

        // Skip lines with numbers at the beginning (like "1. word")
        if (/^\s*\d+\./.test(line)) {
            // Extract the word part after the number
            const match = line.match(/^\s*\d+\.\s*(.+)/);
            if (match) {
                const word = match[1].trim().split(/[\s\"]/)[0];
                if (word && word.length >= 1 && /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(word)) {
                    words.add(word);
                }
            }
            continue;
        }

        // Extract Japanese words directly from the line
        const japaneseMatches = line.match(/[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]+/g);
        if (japaneseMatches) {
            for (const word of japaneseMatches) {
                // Skip very short words and add to set
                if (word.length >= 1 && !/^\d+$/.test(word)) {
                    words.add(word);
                }
            }
        }
    }

    return words;
}

// Read files
const n5Content = fs.readFileSync('succeed-seeding-file/N5words.txt', 'utf-8');
const n4Content = fs.readFileSync('succeed-seeding-file/N4words.txt', 'utf-8');
const n3Content = fs.readFileSync('succeed-seeding-file/N3words.txt', 'utf-8');
const n2Content = fs.readFileSync('succeed-seeding-file/N2words.txt', 'utf-8');
const n1Content = fs.readFileSync('succeed-seeding-file/N1words.txt', 'utf-8');

// Extract words
const n5Words = extractJapaneseWords(n5Content);
const n4Words = extractJapaneseWords(n4Content);
const n3Words = extractJapaneseWords(n3Content);
const n2Words = extractJapaneseWords(n2Content);
const n1Words = extractJapaneseWords(n1Content);

console.log('=== Word Counts ===');
console.log('N5 words:', n5Words.size);
console.log('N4 words:', n4Words.size);
console.log('N3 words:', n3Words.size);
console.log('N2 words:', n2Words.size);
console.log('N1 words:', n1Words.size);

// Find duplicates between N2 and other levels
console.log('\n=== ACTUAL DUPLICATES ===');

// N5 vs N2
const n5n2Duplicates = [...n5Words].filter(word => n2Words.has(word));
console.log('N5와 N2 중복:', n5n2Duplicates.length, '개');
console.log('N5-N2 duplicates:', n5n2Duplicates.sort());

// N4 vs N2
const n4n2Duplicates = [...n4Words].filter(word => n2Words.has(word));
console.log('\nN4와 N2 중복:', n4n2Duplicates.length, '개');
console.log('N4-N2 duplicates:', n4n2Duplicates.sort());

// N3 vs N2
const n3n2Duplicates = [...n3Words].filter(word => n2Words.has(word));
console.log('\nN3와 N2 중복:', n3n2Duplicates.length, '개');
console.log('N3-N2 duplicates:', n3n2Duplicates.sort());

// N1 vs N2
const n1n2Duplicates = [...n1Words].filter(word => n2Words.has(word));
console.log('\nN1과 N2 중복:', n1n2Duplicates.length, '개');
console.log('N1-N2 duplicates:', n1n2Duplicates.sort());