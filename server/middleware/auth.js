// server/middlewares/auth.js
const jwt = require('jsonwebtoken');

// JWT는 httpOnly 쿠키 'token'에 있다고 가정(또는 Authorization 헤더 허용)
module.exports = function auth(req, res, next) {
  try {
    console.log('[AUTH] Checking request to:', req.path, 'method:', req.method);
    
    // 오디오 파일 및 공개 vocab 요청은 인증 제외
    if (req.path.includes('/audio/') || req.path.includes('/audio-files/') || 
        req.path.startsWith('/vocab/list') || req.path.startsWith('/vocab/test') ||
        req.path.startsWith('/vocab/vocab-by-pos') ||
        req.path.startsWith('/exam-vocab/categories') || req.path.startsWith('/api/idiom') ||
        req.path.startsWith('/starter/') || req.path.startsWith('/elementary/') ||
        req.path.startsWith('/intermediate/') || req.path.startsWith('/upper/') ||
        req.path.startsWith('/advanced/')) {
      console.log('[AUTH] Skipping auth for public endpoint:', req.path);
      return next();
    }
    const bearer = req.headers.authorization;
    const token =
      (req.cookies && req.cookies.token) ||
      (bearer && bearer.startsWith('Bearer ') ? bearer.slice(7) : null);

    if (!token) {
      console.log('[AUTH] No token found, blocking request to:', req.path);
      return res.status(401).json({ ok: false, error: 'Unauthorized' });
    }

    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = { 
      id: payload.id, 
      email: payload.email,
      role: payload.role || 'USER' 
    };
    console.log('[AUTH] User authenticated:', req.user);
    return next();
  } catch (err) {
    console.error('[AUTH] Token verification failed:', err.message);
    console.error('[AUTH] Request path:', req.path);
    return res.status(401).json({ ok: false, error: 'Invalid token' });
  }
};
