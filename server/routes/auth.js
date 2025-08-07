// server/routes/auth.js
const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt'); // bcryptjs 대신 bcrypt 사용
const { prisma } = require('../lib/prismaClient');
const { ok, fail } = require('../lib/resp'); // 응답 헬퍼 사용

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_change_me';
const COOKIE_NAME = 'token';
const SLIDING_MINUTES = 15;

function signToken(payload) {
    return jwt.sign(payload, JWT_SECRET, { expiresIn: `${SLIDING_MINUTES}m` });
}

function setAuthCookie(res, token) {
    res.cookie(COOKIE_NAME, token, {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        maxAge: SLIDING_MINUTES * 60 * 1000,
    });
}

router.post('/register', async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) return fail(res, 400, 'Email and password are required');

    try {
        const existingUser = await prisma.user.findUnique({ where: { email } });
        if (existingUser) return fail(res, 409, 'User with this email already exists');

        const passwordHash = await bcrypt.hash(password, 10);
        const userRole = email === 'super@naver.com' ? 'admin' : 'USER'; // 특정 이메일에 admin 권한 부여
        const user = await prisma.user.create({ data: { email, passwordHash, role: userRole } });

        const tokenPayload = { id: user.id, email: user.email, role: user.role };
        setAuthCookie(res, signToken(tokenPayload));

        const { passwordHash: _, ...userSafe } = user;
        return ok(res, userSafe);
    } catch (e) {
        console.error('POST /auth/register failed:', e);
        return fail(res, 500, 'Internal Server Error');
    }
});

router.post('/login', async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) return fail(res, 400, 'email and password required');

    try {
        const user = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });
        if (!user) return fail(res, 401, 'invalid credentials');

        const okPw = await bcrypt.compare(password, user.passwordHash);
        if (!okPw) return fail(res, 401, 'invalid credentials');

        const tokenPayload = { id: user.id, email: user.email, role: user.role };
        setAuthCookie(res, signToken(tokenPayload));
        
        return ok(res, tokenPayload); // 안전한 사용자 정보만 반환
    } catch (e) {
        console.error('POST /auth/login failed:', e);
        return fail(res, 500, 'Internal Server Error');
    }
});

router.post('/logout', (req, res) => {
    res.clearCookie(COOKIE_NAME); // 설정된 쿠키 제거
    return ok(res, { ok: true });
});

module.exports = router;