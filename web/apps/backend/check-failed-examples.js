// server/check-failed-examples.js
const fs = require('fs');

const cefrData = JSON.parse(fs.readFileSync('./cefr_vocabs.json', 'utf8'));

console.log('Failed examples (first 10):');
const failed = cefrData.filter(word => !word.example || word.example === '').slice(0, 10);
for (const word of failed) {
  console.log(`${word.lemma}:`);
  console.log(`  chirpScript: ${word.koChirpScript}`);
  console.log('  ---');
}