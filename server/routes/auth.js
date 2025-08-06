const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const { prisma } = require('../lib/prismaClient');

const router = express.Router();

/* 🔐 회원가입 */
router.post('/auth/register', async (req, res) => {
    const { email, password } = req.body;

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return res.status(400).json({ error: 'email already exists' });

    const passwordHash = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
        data: {
            email,
            passwordHash,
            role: 'USER' // 기본 역할
        }
    });

    return res.status(201).json({ id: user.id });
});

/* 🔐 로그인 */
router.post('/auth/login', async (req, res) => {
    const { email, password } = req.body;

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.status(401).json({ error: 'invalid credentials' });

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return res.status(401).json({ error: 'invalid credentials' });

    const token = jwt.sign(
        { id: user.id, email: user.email, role: user.role },
        process.env.JWT_SECRET,
        { expiresIn: '2h' }
    );

    res.cookie('token', token, {
        httpOnly: true,
        maxAge: 2 * 60 * 60 * 1000, // 2시간
        sameSite: 'Lax',
        secure: false // 프로덕션에서는 true (https 환경)
    });

    res.json({ ok: true });
});

/* 🔓 로그아웃 */
router.post('/auth/logout', (req, res) => {
    res.clearCookie('token');
    res.json({ ok: true });
});

module.exports = router;
