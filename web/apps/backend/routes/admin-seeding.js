// Admin-only seeding route for Railway
const express = require('express');
const router = express.Router();
const { execSync } = require('child_process');
const authMiddleware = require('../middleware/auth');
const adminMiddleware = require('../middleware/admin');

// Manual seeding trigger (admin only)
router.post('/trigger-seeding', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    console.log('[ADMIN SEEDING] Manual seeding triggered by:', req.user.email);

    res.write('data: Starting full production seeding...\n\n');

    // Execute seeding script
    const child = require('child_process').spawn('node', ['scripts/seed-full-production.js'], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: process.env
    });

    child.stdout.on('data', (data) => {
      console.log('[SEEDING]', data.toString());
      res.write(`data: ${data.toString()}\n\n`);
    });

    child.stderr.on('data', (data) => {
      console.error('[SEEDING ERROR]', data.toString());
      res.write(`data: ERROR: ${data.toString()}\n\n`);
    });

    child.on('close', (code) => {
      console.log(`[SEEDING] Process exited with code ${code}`);
      res.write(`data: Seeding completed with code ${code}\n\n`);
      res.end();
    });

  } catch (error) {
    console.error('[ADMIN SEEDING] Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Check seeding status
router.get('/seeding-status', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();

    const vocabCount = await prisma.vocab.count();
    const userCount = await prisma.user.count();
    const readingCount = await prisma.reading.count();

    await prisma.$disconnect();

    res.json({
      vocabCount,
      userCount,
      readingCount,
      needsSeeding: vocabCount === 0
    });
  } catch (error) {
    console.error('[SEEDING STATUS] Error:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;