// server/middleware/adminOnly.js
const { fail } = require('../lib/resp');

/**
 * 운영자 계정(super@root.com)만 접근 가능하도록 하는 미들웨어
 * @param {*} req 
 * @param {*} res 
 * @param {*} next 
 */
function adminOnly(req, res, next) {
    // 디버깅용 로그
    console.log('[ADMIN MIDDLEWARE] req.user:', req.user);
    console.log('[ADMIN MIDDLEWARE] req.user.email:', req.user?.email);
    
    // req.user는 auth 미들웨어에서 설정됨
    if (!req.user) {
        console.log('[ADMIN MIDDLEWARE] No user found');
        return fail(res, 401, 'Authentication required');
    }

    // 운영자 계정 체크
    if (req.user.email !== 'super@root.com') {
        console.log(`[ADMIN MIDDLEWARE] Access denied for user: ${req.user.email}`);
        return fail(res, 403, 'Admin access required');
    }

    console.log('[ADMIN MIDDLEWARE] Admin access granted');
    next();
}

module.exports = adminOnly;