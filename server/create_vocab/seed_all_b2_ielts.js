// server/create_vocab/seed_all_b2_ielts.js
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { execSync } = require('child_process');

const b2Files = [
    'B2/B2_1/ielts_b2_1.json',
    'B2/B2_2/ielts_b2_2.json', 
    'B2/B2_3/ielts_b2_3.json',
    'B2/B2_4/ielts_b2_4.json',
    'B2/B2_5/ielts_b2_5.json',
    'B2/B2_6/ielts_b2_6.json',
    'B2/B2_7/ielts_b2_7.json',
    'B2/B2_8/ielts_b2_8.json'
];

async function seedAllB2Files() {
    console.log('🌱 Starting to seed all IELTS B2 files...\n');
    
    for (const filePath of b2Files) {
        try {
            console.log(`📖 Processing ${filePath}...`);
            const command = `node "${path.join(__dirname, 'seed_b2_from_json.js')}" "${filePath}"`;
            execSync(command, { stdio: 'inherit', cwd: path.join(__dirname, '..') });
            console.log(`✅ Successfully seeded ${filePath}\n`);
        } catch (error) {
            console.error(`❌ Failed to seed ${filePath}:`, error.message);
            console.log('Continuing with next file...\n');
        }
    }
    
    console.log('🌳 All B2 IELTS files seeding completed!');
}

seedAllB2Files().catch(console.error);