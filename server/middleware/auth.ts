// server/middleware/auth.ts
import { Request, Response, NextFunction } from 'express';
import jwtService from '../services/jwtService';
import { UserWithoutPassword, JwtPayload } from '../types';

interface AuthError extends Error {
  code?: string;
}

// Enhanced authentication middleware with refresh token support
export default function auth(req: Request, res: Response, next: NextFunction): Response | void {
  try {
    console.log('[AUTH] Checking request to:', req.path, 'method:', req.method);
    
    // 오디오 파일, 공개 vocab 요청, API 문서는 인증 제외
    if (req.path.includes('/audio/') || req.path.includes('/audio-files/') || 
        req.path.startsWith('/vocab/list') || req.path.startsWith('/vocab/test') ||
        req.path.startsWith('/vocab/vocab-by-pos') ||
        req.path.startsWith('/exam-vocab/categories') || req.path.startsWith('/api/idiom') ||
        req.path.startsWith('/starter/') || req.path.startsWith('/elementary/') ||
        req.path.startsWith('/intermediate/') || req.path.startsWith('/upper/') ||
        req.path.startsWith('/advanced/') || req.path === '/api' || req.path.startsWith('/docs/api')) {
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
    const payload: JwtPayload = jwtService.verifyAccessToken(token);
    
    req.user = { 
      id: payload.userId, 
      email: payload.email,
      role: payload.role || 'user' 
    } as UserWithoutPassword;

    // Check if token is near expiry and add header for client to refresh
    if (jwtService.isTokenNearExpiry(payload as any)) {
      res.setHeader('X-Token-Refresh-Suggested', 'true');
      console.log('[AUTH] Token near expiry, suggesting refresh for user:', req.user.id);
    }

    console.log('[AUTH] User authenticated:', req.user);
    return next();
  } catch (err: any) {
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
}