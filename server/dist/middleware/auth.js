"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = auth;
const jwtService_1 = __importDefault(require("../services/jwtService"));
function auth(req, res, next) {
    try {
        console.log('[AUTH] Checking request to:', req.path, 'method:', req.method);
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
        const token = jwtService_1.default.extractToken(req, 'access');
        if (!token) {
            console.log('[AUTH] No access token found, blocking request to:', req.path);
            return res.status(401).json({
                ok: false,
                error: 'Unauthorized',
                code: 'NO_TOKEN'
            });
        }
        const payload = jwtService_1.default.verifyAccessToken(token);
        req.user = {
            id: payload.userId,
            email: payload.email,
            role: payload.role || 'user'
        };
        if (jwtService_1.default.isTokenNearExpiry(payload)) {
            res.setHeader('X-Token-Refresh-Suggested', 'true');
            console.log('[AUTH] Token near expiry, suggesting refresh for user:', req.user.id);
        }
        console.log('[AUTH] User authenticated:', req.user);
        return next();
    }
    catch (err) {
        console.error('[AUTH] Token verification failed:', err.message);
        console.error('[AUTH] Request path:', req.path);
        let errorCode = 'INVALID_TOKEN';
        let statusCode = 401;
        if (err.message.includes('expired')) {
            errorCode = 'TOKEN_EXPIRED';
        }
        else if (err.message.includes('Invalid')) {
            errorCode = 'INVALID_TOKEN';
        }
        return res.status(statusCode).json({
            ok: false,
            error: err.message || 'Authentication failed',
            code: errorCode
        });
    }
}
