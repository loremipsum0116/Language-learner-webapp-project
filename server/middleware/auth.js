const jwt = require('jsonwebtoken');
const { prisma } = require('../lib/prismaClient');

module.exports = async function auth(req, res, next) {
    try {
        console.log('🔵 AUTH middleware 진입');
        console.log('🔵 headers.cookie:', req.headers.cookie);
        console.log('🔵 req.cookies:', req.cookies);

        const token = req.cookies?.token || req.headers.authorization?.split(' ')[1];
        if (!token) {
            console.log('🔴 토큰 없음');
            return res.status(401).json({ error: 'no token' });
        }

        const payload = jwt.verify(token, process.env.JWT_SECRET);
        console.log('🟢 JWT payload:', payload);

        const user = await prisma.user.findUnique({ where: { id: payload.id } });
        if (!user) {
            console.log('🔴 유저 없음');
            return res.status(401).json({ error: 'invalid user' });
        }

        req.user = { id: user.id, role: user.role };
        console.log('✅ 인증 완료 → next()');
        next();
    } catch (e) {
        console.error('[AUTH ERROR]', e.message);
        return res.status(401).json({ error: 'unauthorized' });
    }
};
