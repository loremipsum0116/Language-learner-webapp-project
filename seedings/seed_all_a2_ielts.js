// server/create_vocab/seed_all_a2_ielts.js
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { execSync } = require('child_process');

const a2Files = [
    'A2/A2_1/ielts_a2_1.json',
    'A2/A2_2/ielts_a2_2.json', 
    'A2/A2_3/ielts_a2_3.json',
    'A2/A2_4/ielts_a2_4.json',
    'A2/A2_5/ielts_a2_5.json',
    'A2/A2_6/ielts_a2_6.json',
    'A2/A2_7/ielts_a2_7.json',
    'A2/A2_8/ielts_a2_8.json',
    'A2/A2_9/ielts_a2_9.json'
];

async function seedAllA2Files() {
    console.log('🌱 Starting to seed all IELTS A2 files...\n');
    
    for (const filePath of a2Files) {
        try {
            console.log(`📖 Processing ${filePath}...`);
            const command = `node "${path.join(__dirname, 'seed_a2_from_json.js')}" "${filePath}"`;
            execSync(command, { stdio: 'inherit', cwd: path.join(__dirname, '..') });
            console.log(`✅ Successfully seeded ${filePath}\n`);
        } catch (error) {
            console.error(`❌ Failed to seed ${filePath}:`, error.message);
            console.log('Continuing with next file...\n');
        }
    }
    
    console.log('🌳 All A2 IELTS files seeding completed!');
}

seedAllA2Files().catch(console.error);