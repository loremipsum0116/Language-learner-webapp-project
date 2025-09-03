// services/jwtService.ts
import jwt from 'jsonwebtoken';
import { Request, Response } from 'express';
import crypto from 'crypto';
import { JwtPayload, DeviceInfo, UserWithoutPassword } from '../types';

interface TokenPayload {
  id: number;
  email: string;
  role: string;
}

interface DecodedToken extends TokenPayload {
  type: string;
  iat: number;
  exp: number;
}

interface TokenPair {
  accessToken: string;
  refreshToken: string;
  refreshTokenExpiresAt: Date;
}

class JWTService {
  private readonly JWT_SECRET: string;
  private readonly ACCESS_TOKEN_EXPIRY = '15m'; // Short-lived access tokens
  private readonly COOKIE_NAME = 'token';
  private readonly REFRESH_COOKIE_NAME = 'refreshToken';

  constructor() {
    this.JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_change_me';
  }

  /**
   * Generate access token (JWT)
   */
  generateAccessToken(payload: TokenPayload): string {
    return jwt.sign(
      {
        id: payload.id,
        email: payload.email,
        role: payload.role,
        type: 'access'
      },
      this.JWT_SECRET,
      { 
        expiresIn: this.ACCESS_TOKEN_EXPIRY,
        issuer: 'deutsch-learner-api',
        audience: 'deutsch-learner-client'
      }
    );
  }

  /**
   * Generate access token with user ID (legacy support)
   */
  generateAccessTokenById(userId: number): string {
    throw new Error('User ID only access token generation is deprecated. Use generateAccessToken with full payload.');
  }

  /**
   * Verify and decode access token
   */
  verifyAccessToken(token: string): JwtPayload {
    try {
      const decoded = jwt.verify(token, this.JWT_SECRET, {
        issuer: 'deutsch-learner-api',
        audience: 'deutsch-learner-client'
      }) as DecodedToken;

      // Verify token type
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
    } catch (error: any) {
      if (error.name === 'TokenExpiredError') {
        throw new Error('Access token has expired');
      } else if (error.name === 'JsonWebTokenError') {
        throw new Error('Invalid access token');
      } else {
        throw error;
      }
    }
  }

  /**
   * Set authentication cookies
   */
  setAuthCookies(res: Response, accessToken: string, refreshToken: string): void {
    // Set access token cookie (short-lived)
    res.cookie(this.COOKIE_NAME, accessToken, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 15 * 60 * 1000, // 15 minutes
      path: '/'
    });

    // Set refresh token cookie (long-lived)
    res.cookie(this.REFRESH_COOKIE_NAME, refreshToken, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      path: '/auth' // Only send refresh token to auth endpoints
    });
  }

  /**
   * Clear authentication cookies
   */
  clearAuthCookies(res: Response): void {
    res.clearCookie(this.COOKIE_NAME, { path: '/' });
    res.clearCookie(this.REFRESH_COOKIE_NAME, { path: '/auth' });
  }

  /**
   * Extract token from request (cookie or Authorization header)
   */
  extractToken(req: Request, tokenType: 'access' | 'refresh' = 'access'): string | null {
    if (tokenType === 'access') {
      // Check Authorization header first (for mobile apps)
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        return authHeader.substring(7);
      }
      
      // Fall back to cookie (for web browsers)
      return req.cookies?.[this.COOKIE_NAME] || null;
    } else if (tokenType === 'refresh') {
      // Refresh tokens only come from cookies for security
      return req.cookies?.[this.REFRESH_COOKIE_NAME] || null;
    }
    
    return null;
  }

  /**
   * Get device information from request
   */
  getDeviceInfo(req: Request): DeviceInfo {
    return {
      platform: req.headers['x-platform'] as string || this.detectPlatform(req),
      appVersion: req.headers['x-app-version'] as string || '1.0.0',
      deviceModel: req.headers['x-device-model'] as string || this.getDeviceName(req),
      osVersion: req.headers['x-os-version'] as string || 'Unknown',
      userAgent: req.headers['user-agent'] || 'Unknown'
    };
  }

  /**
   * Detect platform from user agent
   */
  private detectPlatform(req: Request): string {
    const userAgent = req.headers['user-agent'] || '';
    
    if (userAgent.includes('iPhone') || userAgent.includes('iOS')) {
      return 'ios';
    } else if (userAgent.includes('Android')) {
      return 'android';
    } else {
      return 'web';
    }
  }

  /**
   * Generate a device ID based on request information
   */
  generateDeviceId(req: Request): string {
    const userAgent = req.headers['user-agent'] || '';
    const ip = req.ip || (req as any).connection?.remoteAddress || '';
    const acceptLanguage = req.headers['accept-language'] || '';
    
    const deviceString = `${userAgent}-${ip}-${acceptLanguage}`;
    return crypto.createHash('md5').update(deviceString).digest('hex');
  }

  /**
   * Get a human-readable device name from user agent
   */
  getDeviceName(req: Request): string {
    const userAgent = req.headers['user-agent'] || '';
    
    // Simple device detection
    if (userAgent.includes('Mobile') || userAgent.includes('Android')) {
      if (userAgent.includes('Android')) return 'Android Device';
      if (userAgent.includes('iPhone')) return 'iPhone';
      return 'Mobile Device';
    }
    
    if (userAgent.includes('iPad')) return 'iPad';
    if (userAgent.includes('Macintosh')) return 'Mac';
    if (userAgent.includes('Windows')) return 'Windows PC';
    if (userAgent.includes('Linux')) return 'Linux PC';
    
    return 'Unknown Device';
  }

  /**
   * Check if token is about to expire (within 5 minutes)
   */
  isTokenNearExpiry(decoded: DecodedToken): boolean {
    if (!decoded.exp) return false;
    
    const now = Math.floor(Date.now() / 1000);
    const fiveMinutes = 5 * 60;
    
    return (decoded.exp - now) <= fiveMinutes;
  }

  /**
   * Generate both access and refresh tokens for a user
   */
  async generateTokenPair(user: UserWithoutPassword, deviceInfo: DeviceInfo): Promise<TokenPair> {
    const refreshTokenService = require('./refreshTokenService');
    
    // Generate access token
    const accessToken = this.generateAccessToken({
      id: user.id,
      email: user.email,
      role: user.role
    });

    // Generate refresh token
    const refreshTokenData = await refreshTokenService.createRefreshToken(
      user.id,
      deviceInfo
    );

    return {
      accessToken,
      refreshToken: refreshTokenData.token,
      refreshTokenExpiresAt: refreshTokenData.expiresAt
    };
  }
}

export default new JWTService();