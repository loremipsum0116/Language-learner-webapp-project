// server/routes/user.js
const express = require('express');
const router = express.Router();
const { prisma } = require('../lib/prismaClient');

// GET /me
router.get('/me', async (req, res) => {
    const user = await prisma.user.findUnique({
        where: { id: req.user.id },
        select: { id: true, email: true, role: true, profile: true }
    });
    if (!user) return res.status(404).json({ error: 'User not found' });
    return res.json({ data: user });
});

module.exports = router;