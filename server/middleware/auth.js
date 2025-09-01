// server/middlewares/auth.js
const jwtService = require('../services/jwtService');

// Enhanced authentication middleware with refresh token support
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

    // Extract access token from request (cookie or Authorization header)
    const token = jwtService.extractToken(req, 'access');

    if (!token) {
      console.log('[AUTH] No access token found, blocking request to:', req.path);
      return res.status(401).json({ 
        ok: false, 
        error: 'Unauthorized',
        code: 'NO_TOKEN'
      });
    }

    // Verify access token using JWT service
    const payload = jwtService.verifyAccessToken(token);
    
    req.user = { 
      id: payload.id, 
      email: payload.email,
      role: payload.role || 'USER' 
    };

    // Check if token is near expiry and add header for client to refresh
    if (jwtService.isTokenNearExpiry(payload)) {
      res.setHeader('X-Token-Refresh-Suggested', 'true');
      console.log('[AUTH] Token near expiry, suggesting refresh for user:', req.user.id);
    }

    console.log('[AUTH] User authenticated:', req.user);
    return next();
  } catch (err) {
    console.error('[AUTH] Token verification failed:', err.message);
    console.error('[AUTH] Request path:', req.path);
    
    // Determine the type of error for better client handling
    let errorCode = 'INVALID_TOKEN';
    let statusCode = 401;
    
    if (err.message.includes('expired')) {
      errorCode = 'TOKEN_EXPIRED';
    } else if (err.message.includes('Invalid')) {
      errorCode = 'INVALID_TOKEN';
    }

    return res.status(statusCode).json({ 
      ok: false, 
      error: err.message || 'Authentication failed',
      code: errorCode
    });
  }
};
