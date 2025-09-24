// Create admin user for Railway deployment
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function seedAdmin() {
  try {
    console.log('[SEED] Checking for admin user...');

    // Check if admin already exists
    const existingAdmin = await prisma.user.findUnique({
      where: { email: 'super@root.com' }
    });

    if (existingAdmin) {
      console.log('[SEED] Admin user already exists');
      return;
    }

    // Create admin user
    const hashedPassword = await bcrypt.hash('admin123', 10);

    const adminUser = await prisma.user.create({
      data: {
        email: 'super@root.com',
        passwordHash: hashedPassword,
        role: 'SUPERADMIN',
        isApproved: true,
        name: 'Super Admin'
      }
    });

    console.log('[SEED] Admin user created:', adminUser.email);

    // Create basic language if doesn't exist
    const englishLang = await prisma.language.findFirst({
      where: { code: 'en' }
    });

    if (!englishLang) {
      await prisma.language.create({
        data: {
          code: 'en',
          name: 'English'
        }
      });
      console.log('[SEED] English language created');
    }

    // Create basic language if doesn't exist
    const japaneseLang = await prisma.language.findFirst({
      where: { code: 'ja' }
    });

    if (!japaneseLang) {
      await prisma.language.create({
        data: {
          code: 'ja',
          name: 'Japanese'
        }
      });
      console.log('[SEED] Japanese language created');
    }

    console.log('[SEED] Basic setup completed');
  } catch (error) {
    console.error('[SEED] Error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

seedAdmin();