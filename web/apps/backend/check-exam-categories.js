const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkExamCategories() {
  try {
    console.log('Checking exam categories...');
    
    // Check if exam categories exist
    const examCategories = await prisma.examcategory.findMany();
    console.log('Exam categories:', examCategories);
    
    // Check vocab-exam relationships
    const vocabExamLinks = await prisma.vocabexamcategory.findMany({
      take: 5,
      include: {
        examCategory: true,
        vocab: true
      }
    });
    console.log('Sample vocab-exam links:', vocabExamLinks);
    
    // Count total vocabs
    const totalVocabs = await prisma.vocab.count();
    console.log('Total vocabs:', totalVocabs);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkExamCategories();