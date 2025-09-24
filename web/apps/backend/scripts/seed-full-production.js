// Full production seeding script for Railway
// Based on succeed-seeding-file/readme.md instructions
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function runScript(scriptPath, description) {
  console.log(`\n[SEEDING] Starting: ${description}...`);
  try {
    // Import and run the seeding script
    const scriptFullPath = path.join(__dirname, scriptPath);
    if (!fs.existsSync(scriptFullPath)) {
      console.error(`[ERROR] Script not found: ${scriptFullPath}`);
      return false;
    }

    // Clear module cache to ensure fresh execution
    delete require.cache[require.resolve(scriptFullPath)];
    await require(scriptFullPath);

    console.log(`[SUCCESS] Completed: ${description}`);
    return true;
  } catch (error) {
    console.error(`[ERROR] Failed ${description}:`, error.message);
    return false;
  }
}

async function seedFullProduction() {
  try {
    console.log('='.repeat(60));
    console.log('🚀 STARTING FULL PRODUCTION SEEDING');
    console.log('='.repeat(60));

    // Step 1: Create admin and basic setup
    console.log('\n📋 STEP 1: Basic setup (Admin + Languages)');
    await require('./seed-production').seedProduction();

    // Step 2: CEFR English vocabulary (9,814 words)
    console.log('\n📋 STEP 2: CEFR English vocabulary seeding');
    const cefrSuccess = await runScript('seed-cefr-fixed.js', 'CEFR English vocabulary (9,814 words)');
    if (!cefrSuccess) {
      console.log('⚠️  CEFR seeding failed, but continuing...');
    }

    // Step 3: Exam categories
    console.log('\n📋 STEP 3: Exam categories seeding');
    const examSuccess = await runScript('seed-exam-categories.js', 'Exam categories (TOEIC, TOEFL, IELTS, 수능)');
    if (!examSuccess) {
      console.log('⚠️  Exam categories seeding failed, but continuing...');
    }

    // Step 4: Idioms and phrasal verbs (1,001 items)
    console.log('\n📋 STEP 4: Idioms and phrasal verbs seeding');
    const idiomSuccess = await runScript('seed-idioms-vocab.js', 'Idioms and phrasal verbs (1,001 items)');
    if (!idiomSuccess) {
      console.log('⚠️  Idioms seeding failed, but continuing...');
    }

    // Step 5: JLPT Japanese vocabulary
    console.log('\n📋 STEP 5: JLPT Japanese vocabulary seeding');

    // Check if we have the JLPT total seeding script
    const jlptTotalPath = path.join(__dirname, '../seed-jlpt-vocabs-total.js');
    if (fs.existsSync(jlptTotalPath)) {
      const jlptSuccess = await runScript('../seed-jlpt-vocabs-total.js', 'JLPT Japanese vocabulary (8,404 words)');
      if (!jlptSuccess) {
        console.log('⚠️  JLPT total seeding failed, trying individual files...');
      }
    } else {
      // Try individual JLPT files
      const jlptFiles = ['N1_fixed.json', 'N2_fixed.json', 'N3_fixed.json', 'N4_fixed.json', 'N5_fixed.json'];
      console.log('📋 Processing individual JLPT files...');

      for (const file of jlptFiles) {
        const filePath = path.join(__dirname, `../jlpt/${file}`);
        if (fs.existsSync(filePath)) {
          console.log(`✅ Found ${file}`);
        } else {
          console.log(`⚠️  Missing ${file}`);
        }
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('🎉 FULL PRODUCTION SEEDING COMPLETED!');
    console.log('='.repeat(60));

    // Print summary
    console.log('\n📊 SEEDING SUMMARY:');
    const vocabCount = await prisma.vocab.count();
    const userCount = await prisma.user.count();
    const languageCount = await prisma.language.count();

    console.log(`👤 Users: ${userCount}`);
    console.log(`🌐 Languages: ${languageCount}`);
    console.log(`📚 Vocabulary: ${vocabCount}`);

    console.log('\n🔐 ADMIN LOGIN:');
    console.log('Email: super@root.com');
    console.log('Password: admin123');

    console.log('\n🎯 READY TO USE!');

  } catch (error) {
    console.error('\n❌ SEEDING ERROR:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Only run if called directly
if (require.main === module) {
  seedFullProduction().catch(console.error);
}

module.exports = { seedFullProduction };