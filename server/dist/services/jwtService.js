"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const crypto_1 = __importDefault(require("crypto"));
class JWTService {
    constructor() {
        this.ACCESS_TOKEN_EXPIRY = '15m';
        this.COOKIE_NAME = 'token';
        this.REFRESH_COOKIE_NAME = 'refreshToken';
        this.JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_change_me';
    }
    generateAccessToken(payload) {
        return jsonwebtoken_1.default.sign({
            id: payload.id,
            email: payload.email,
            role: payload.role,
            type: 'access'
        }, this.JWT_SECRET, {
            expiresIn: this.ACCESS_TOKEN_EXPIRY,
            issuer: 'deutsch-learner-api',
            audience: 'deutsch-learner-client'
        });
    }
    generateAccessTokenById(userId) {
        throw new Error('User ID only access token generation is deprecated. Use generateAccessToken with full payload.');
    }
    verifyAccessToken(token) {
        try {
            const decoded = jsonwebtoken_1.default.verify(token, this.JWT_SECRET, {
                issuer: 'deutsch-learner-api',
                audience: 'deutsch-learner-client'
            });
            if (decoded.type !== 'access') {
                throw new Error('Invalid token type');
            }
            return {
                userId: decoded.id,
                email: decoded.email,
                role: decoded.role,
                iat: decoded.iat,
                exp: decoded.exp
            };
        }
        catch (error) {
            if (error.name === 'TokenExpiredError') {
                throw new Error('Access token has expired');
            }
            else if (error.name === 'JsonWebTokenError') {
                throw new Error('Invalid access token');
            }
            else {
                throw error;
            }
        }
    }
    setAuthCookies(res, accessToken, refreshToken) {
        res.cookie(this.COOKIE_NAME, accessToken, {
            httpOnly: true,
            sameSite: 'lax',
            secure: process.env.NODE_ENV === 'production',
            maxAge: 15 * 60 * 1000,
            path: '/'
        });
        res.cookie(this.REFRESH_COOKIE_NAME, refreshToken, {
            httpOnly: true,
            sameSite: 'lax',
            secure: process.env.NODE_ENV === 'production',
            maxAge: 30 * 24 * 60 * 60 * 1000,
            path: '/auth'
        });
    }
    clearAuthCookies(res) {
        res.clearCookie(this.COOKIE_NAME, { path: '/' });
        res.clearCookie(this.REFRESH_COOKIE_NAME, { path: '/auth' });
    }
    extractToken(req, tokenType = 'access') {
        if (tokenType === 'access') {
            const authHeader = req.headers.authorization;
            if (authHeader && authHeader.startsWith('Bearer ')) {
                return authHeader.substring(7);
            }
            return req.cookies?.[this.COOKIE_NAME] || null;
        }
        else if (tokenType === 'refresh') {
            return req.cookies?.[this.REFRESH_COOKIE_NAME] || null;
        }
        return null;
    }
    getDeviceInfo(req) {
        return {
            platform: req.headers['x-platform'] || this.detectPlatform(req),
            appVersion: req.headers['x-app-version'] || '1.0.0',
            deviceModel: req.headers['x-device-model'] || this.getDeviceName(req),
            osVersion: req.headers['x-os-version'] || 'Unknown',
            userAgent: req.headers['user-agent'] || 'Unknown'
        };
    }
    detectPlatform(req) {
        const userAgent = req.headers['user-agent'] || '';
        if (userAgent.includes('iPhone') || userAgent.includes('iOS')) {
            return 'ios';
        }
        else if (userAgent.includes('Android')) {
            return 'android';
        }
        else {
            return 'web';
        }
    }
    generateDeviceId(req) {
        const userAgent = req.headers['user-agent'] || '';
        const ip = req.ip || req.connection?.remoteAddress || '';
        const acceptLanguage = req.headers['accept-language'] || '';
        const deviceString = `${userAgent}-${ip}-${acceptLanguage}`;
        return crypto_1.default.createHash('md5').update(deviceString).digest('hex');
    }
    getDeviceName(req) {
        const userAgent = req.headers['user-agent'] || '';
        if (userAgent.includes('Mobile') || userAgent.includes('Android')) {
            if (userAgent.includes('Android'))
                return 'Android Device';
            if (userAgent.includes('iPhone'))
                return 'iPhone';
            return 'Mobile Device';
        }
        if (userAgent.includes('iPad'))
            return 'iPad';
        if (userAgent.includes('Macintosh'))
            return 'Mac';
        if (userAgent.includes('Windows'))
            return 'Windows PC';
        if (userAgent.includes('Linux'))
            return 'Linux PC';
        return 'Unknown Device';
    }
    isTokenNearExpiry(decoded) {
        if (!decoded.exp)
            return false;
        const now = Math.floor(Date.now() / 1000);
        const fiveMinutes = 5 * 60;
        return (decoded.exp - now) <= fiveMinutes;
    }
    async generateTokenPair(user, deviceInfo) {
        const refreshTokenService = require('./refreshTokenService');
        const accessToken = this.generateAccessToken({
            id: user.id,
            email: user.email,
            role: user.role
        });
        const refreshTokenData = await refreshTokenService.createRefreshToken(user.id, deviceInfo);
        return {
            accessToken,
            refreshToken: refreshTokenData.token,
            refreshTokenExpiresAt: refreshTokenData.expiresAt
        };
    }
}
exports.default = new JWTService();
