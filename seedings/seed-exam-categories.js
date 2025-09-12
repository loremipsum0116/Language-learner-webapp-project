const { PrismaClient } = require('@prisma/client');
const fs = require('fs');

const prisma = new PrismaClient();

async function seedExamCategories() {
  try {
    console.log('Starting exam categories seeding...');
    
    // Read the cefr_vocabs.json file
    const vocabData = JSON.parse(fs.readFileSync('cefr_vocabs.json', 'utf8'));
    console.log(`Loaded ${vocabData.length} vocabulary items`);
    
    // Extract unique exam categories from the data
    const examCategoriesSet = new Set();
    
    vocabData.forEach(vocab => {
      if (vocab.categories) {
        // Split categories by comma and clean up
        const categories = vocab.categories.split(',')
          .map(cat => cat.trim())
          .filter(cat => cat && cat !== '입문'); // Exclude '입문' as it's not an exam
        
        categories.forEach(cat => {
          // Map common exam names
          let mappedCat = cat;
          if (cat.includes('IELTS')) mappedCat = 'IELTS';
          if (cat.includes('TOEIC')) mappedCat = 'TOEIC';
          if (cat.includes('TOEFL')) mappedCat = 'TOEFL';
          if (cat === '수능') mappedCat = '수능';
          
          if (['TOEIC', 'TOEFL', 'IELTS', '수능'].includes(mappedCat)) {
            examCategoriesSet.add(mappedCat);
          }
        });
      }
    });
    
    const examCategories = Array.from(examCategoriesSet);
    console.log('Found exam categories:', examCategories);
    
    // Create exam categories
    for (const examName of examCategories) {
      try {
        const examCategory = await prisma.examcategory.upsert({
          where: { name: examName },
          update: {},
          create: {
            name: examName,
            description: `${examName} exam vocabulary`,
            totalWords: 0
          }
        });
        console.log(`Created/found exam category: ${examName} (ID: ${examCategory.id})`);
      } catch (error) {
        console.error(`Error creating exam category ${examName}:`, error);
      }
    }
    
    // Get all exam categories from DB
    const allExamCategories = await prisma.examcategory.findMany();
    const examCategoryMap = {};
    allExamCategories.forEach(cat => {
      examCategoryMap[cat.name] = cat.id;
    });
    
    console.log('Exam category map:', examCategoryMap);
    
    // Now link vocabularies to exam categories
    let processed = 0;
    let linked = 0;
    
    for (const vocab of vocabData) {
      processed++;
      
      if (processed % 1000 === 0) {
        console.log(`Processed ${processed}/${vocabData.length} vocabulary items...`);
      }
      
      if (!vocab.categories) continue;
      
      // Find the vocab in database by lemma
      const dbVocab = await prisma.vocab.findFirst({
        where: {
          lemma: vocab.lemma,
          language: { code: 'en' }
        }
      });
      
      if (!dbVocab) {
        console.log(`Vocab not found in DB: ${vocab.lemma}`);
        continue;
      }
      
      // Extract exam categories for this vocab
      const categories = vocab.categories.split(',')
        .map(cat => cat.trim())
        .filter(cat => cat && cat !== '입문');
      
      for (const cat of categories) {
        let mappedCat = cat;
        if (cat.includes('IELTS')) mappedCat = 'IELTS';
        if (cat.includes('TOEIC')) mappedCat = 'TOEIC';
        if (cat.includes('TOEFL')) mappedCat = 'TOEFL';
        if (cat === '수능') mappedCat = '수능';
        
        const examCategoryId = examCategoryMap[mappedCat];
        if (examCategoryId) {
          try {
            await prisma.vocabexamcategory.upsert({
              where: {
                vocabId_examCategoryId: {
                  vocabId: dbVocab.id,
                  examCategoryId: examCategoryId
                }
              },
              update: {},
              create: {
                vocabId: dbVocab.id,
                examCategoryId: examCategoryId,
                priority: 0
              }
            });
            linked++;
          } catch (error) {
            console.error(`Error linking vocab ${vocab.lemma} to exam ${mappedCat}:`, error.message);
          }
        }
      }
    }
    
    console.log(`Processed ${processed} vocabulary items`);
    console.log(`Created ${linked} vocab-exam links`);
    
    // Update exam category counts
    for (const [examName, examId] of Object.entries(examCategoryMap)) {
      const count = await prisma.vocabexamcategory.count({
        where: { examCategoryId: examId }
      });
      
      await prisma.examcategory.update({
        where: { id: examId },
        data: { totalWords: count }
      });
      
      console.log(`Updated ${examName} category with ${count} words`);
    }
    
    console.log('Exam categories seeding completed!');
    
  } catch (error) {
    console.error('Error seeding exam categories:', error);
  } finally {
    await prisma.$disconnect();
  }
}

seedExamCategories();