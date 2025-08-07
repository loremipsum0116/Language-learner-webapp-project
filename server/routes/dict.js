// server/routes/dict.js
const express = require('express');
const router = express.Router();
const { prisma } = require('../lib/prismaClient');



/* GET /dict/search?q=lemma */
// server/routes/dict.js
router.get('/search', async (req, res) => {
  const q = (req.query.q || '').trim().toLowerCase();
  if (!q) return res.status(400).json({ error: 'q required' });

  const v = await prisma.vocab.findFirst({ where: { lemma: q } });
  if (v?.dictMeta) return res.json({ data: v.dictMeta });

  return res.status(404).json({ error: 'not found' });
});


module.exports = router;
