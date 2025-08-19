// server/middlewares/auth.js
const jwt = require('jsonwebtoken');

// JWT는 httpOnly 쿠키 'token'에 있다고 가정(또는 Authorization 헤더 허용)
module.exports = function auth(req, res, next) {
  try {
    console.log('[AUTH] Checking request to:', req.path);
    
    // 오디오 파일 요청은 인증 제외
    if (req.path.includes('/audio/') || req.path.includes('/audio-files/')) {
      console.log('[AUTH] Skipping auth for audio file:', req.path);
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
    req.user = { id: payload.id, role: payload.role || 'USER' };
    return next();
  } catch (err) {
    return res.status(401).json({ ok: false, error: 'Invalid token' });
  }
};
