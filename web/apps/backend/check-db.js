// Check actual database data
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkDatabase() {
  try {
    // Check SRS cards count
    const srsCardCount = await prisma.srscard.count();
    console.log('Total SRS Cards in DB:', srsCardCount);
    
    // Get some SRS cards
    const srsCards = await prisma.srscard.findMany({
      take: 5,
      include: {
        vocab: true
      }
    });
    console.log('\nSample SRS Cards:', srsCards.length);
    
    // Check vocab count
    const vocabCount = await prisma.vocab.count();
    console.log('\nTotal Vocab in DB:', vocabCount);
    
    // Check users
    const userCount = await prisma.user.count();
    console.log('Total Users in DB:', userCount);
    
    // Get SRS stats for userId 1 (if exists)
    if (userCount > 0) {
      const userId = 1;
      const availableCards = await prisma.srscard.count({
        where: {
          userId,
          nextReview: {
            lte: new Date()
          }
        }
      });
      
      const totalUserCards = await prisma.srscard.count({
        where: { userId }
      });
      
      const masteredCards = await prisma.srscard.count({
        where: {
          userId,
          stage: {
            gte: 7 // Assuming stage 7+ is mastered
          }
        }
      });
      
      console.log(`\nUser ${userId} SRS Stats:`);
      console.log('- Available for review:', availableCards);
      console.log('- Total cards:', totalUserCards);
      console.log('- Mastered cards:', masteredCards);
    }
    
  } catch (error) {
    console.error('Database check failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkDatabase();