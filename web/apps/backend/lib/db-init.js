// Database initialization with automatic migration
const { PrismaClient } = require('@prisma/client');

async function initializeDatabase() {
  const prisma = new PrismaClient();

  try {
    console.log('[DB] Checking database connection...');

    // Test connection
    await prisma.$connect();
    console.log('[DB] Connected successfully');

    // Check if tables exist by trying a simple query
    try {
      await prisma.user.findFirst();
      console.log('[DB] Database tables exist');
    } catch (error) {
      if (error.code === 'P2021') {
        console.log('[DB] Tables do not exist, creating schema...');

        // Run migration using execSync to ensure it completes
        const { execSync } = require('child_process');
        try {
          execSync('npx prisma db push --accept-data-loss', {
            stdio: 'inherit',
            env: process.env
          });
          console.log('[DB] Database schema created successfully');

          // Run seeding after schema creation
          console.log('[DB] Running data seeding...');
          try {
            if (process.env.RUN_FULL_SEEDING === 'true') {
              console.log('[DB] Full production seeding requested...');
              execSync('node scripts/seed-full-production.js', {
                stdio: 'inherit',
                env: process.env,
                timeout: 600000 // 10 minutes timeout for full seeding
              });
              console.log('[DB] Full production seeding completed');
            } else {
              // Basic seeding only
              execSync('node scripts/seed-admin.js', {
                stdio: 'inherit',
                env: process.env
              });
              console.log('[DB] Basic admin seeding completed');
            }
          } catch (seedError) {
            console.error('[DB] Seeding failed:', seedError.message);
          }
        } catch (migrationError) {
          console.error('[DB] Migration failed:', migrationError.message);
          // Continue anyway - some tables might exist
        }
      } else {
        console.log('[DB] Database check error:', error.message);
      }
    }

    await prisma.$disconnect();
    return true;
  } catch (error) {
    console.error('[DB] Initialization error:', error.message);
    await prisma.$disconnect();
    return false;
  }
}

module.exports = { initializeDatabase };