// server/create_vocab/seed_all_c1_ielts.js
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { execSync } = require('child_process');

const c1Files = [
    'C1/C1_1/ielts_c1_1.json',
    'C1/C1_2/ielts_c1_2.json', 
    'C1/C1_3/ielts_c1_3.json',
    'C1/C1_4/ielts_c1_4.json',
    'C1/C1_5/ielts_c1_5.json',
    'C1/C1_6/C1_6.json',
    'C1/C1_7/C1_7.json'
];

async function seedAllC1Files() {
    console.log('🌱 Starting to seed all IELTS C1 files...\n');
    
    for (const filePath of c1Files) {
        try {
            console.log(`📖 Processing ${filePath}...`);
            const command = `node "${path.join(__dirname, 'seed_c1_from_json.js')}" "${filePath}"`;
            execSync(command, { stdio: 'inherit', cwd: path.join(__dirname, '..') });
            console.log(`✅ Successfully seeded ${filePath}\n`);
        } catch (error) {
            console.error(`❌ Failed to seed ${filePath}:`, error.message);
            console.log('Continuing with next file...\n');
        }
    }
    
    console.log('🌳 All C1 IELTS files seeding completed!');
}

seedAllC1Files().catch(console.error);