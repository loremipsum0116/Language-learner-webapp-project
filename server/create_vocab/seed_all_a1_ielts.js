// server/create_vocab/seed_all_a1_ielts.js
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { execSync } = require('child_process');

const a1Files = [
    'A1/A1_1/ielts_a1_1.json',
    'A1/A1_2/ielts_a1_2.json', 
    'A1/A1_3/ielts_a1_3.json',
    'A1/A1_4/ielts_a1_4.json',
    'A1/A1_5/ielts_a1_5.json',
    'A1/A1_6/ielts_a1_6.json',
    'A1/A1_7/ielts_a1_7.json',
    'A1/A1_8/ielts_a1_8.json',
    'A1/A1_9/ielts_a1_9.json'
];

async function seedAllA1Files() {
    console.log('🌱 Starting to seed all IELTS A1 files...\n');
    
    for (const filePath of a1Files) {
        try {
            console.log(`📖 Processing ${filePath}...`);
            const command = `node "${path.join(__dirname, 'seed_a1_from_json.js')}" "${filePath}"`;
            execSync(command, { stdio: 'inherit', cwd: path.join(__dirname, '..') });
            console.log(`✅ Successfully seeded ${filePath}\n`);
        } catch (error) {
            console.error(`❌ Failed to seed ${filePath}:`, error.message);
            console.log('Continuing with next file...\n');
        }
    }
    
    console.log('🌳 All A1 IELTS files seeding completed!');
}

seedAllA1Files().catch(console.error);