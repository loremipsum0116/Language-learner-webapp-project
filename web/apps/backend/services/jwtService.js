const jwt = require('jsonwebtoken');

class JWTService {
  constructor() {
    this.JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_change_me';
    this.ACCESS_TOKEN_EXPIRY = '7d'; // Long-lived access tokens
    this.COOKIE_NAME = 'token';
    this.REFRESH_COOKIE_NAME = 'refreshToken';
  }

  /**
   * Generate access token (JWT)
   * @param {Object} payload - Token payload
   * @param {number} payload.id - User ID
   * @param {string} payload.email - User email
   * @param {string} payload.role - User role
   */
  generateAccessToken(payload) {
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
   * Verify and decode access token
   * @param {string} token - JWT token to verify
   */
  verifyAccessToken(token) {
    try {
      const decoded = jwt.verify(token, this.JWT_SECRET, {
        issuer: 'deutsch-learner-api',
        audience: 'deutsch-learner-client'
      });

      // Verify token type
      if (decoded.type !== 'access') {
        throw new Error('Invalid token type');
      }

      return {
        id: decoded.id,
        email: decoded.email,
        role: decoded.role,
        iat: decoded.iat,
        exp: decoded.exp
      };
    } catch (error) {
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
   * @param {Object} res - Express response object
   * @param {string} accessToken - JWT access token
   * @param {string} refreshToken - Refresh token
   */
  setAuthCookies(res, accessToken, refreshToken) {
    // For cross-origin deployment, use more permissive cookie settings
    const isProduction = process.env.NODE_ENV === 'production';

    // Set access token cookie
    res.cookie(this.COOKIE_NAME, accessToken, {
      httpOnly: true,
      sameSite: isProduction ? 'none' : 'lax', // 'none' for cross-origin
      secure: isProduction, // HTTPS required for sameSite=none
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      path: '/',
      domain: isProduction ? undefined : undefined // Let browser handle domain
    });

    // Set refresh token cookie
    res.cookie(this.REFRESH_COOKIE_NAME, refreshToken, {
      httpOnly: true,
      sameSite: isProduction ? 'none' : 'lax',
      secure: isProduction,
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      path: '/auth',
      domain: isProduction ? undefined : undefined
    });
  }

  /**
   * Clear authentication cookies
   * @param {Object} res - Express response object
   */
  clearAuthCookies(res) {
    res.clearCookie(this.COOKIE_NAME, { path: '/' });
    res.clearCookie(this.REFRESH_COOKIE_NAME, { path: '/auth' });
  }

  /**
   * Extract token from request (cookie or Authorization header)
   * @param {Object} req - Express request object
   * @param {string} tokenType - 'access' or 'refresh'
   */
  extractToken(req, tokenType = 'access') {
    if (tokenType === 'access') {
      // Check Authorization header first (for mobile apps)
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        return authHeader.substring(7);
      }
      
      // Fall back to cookie (for web browsers)
      return req.cookies[this.COOKIE_NAME];
    } else if (tokenType === 'refresh') {
      // Refresh tokens only come from cookies for security
      return req.cookies[this.REFRESH_COOKIE_NAME];
    }
    
    return null;
  }

  /**
   * Get device information from request
   * @param {Object} req - Express request object
   */
  getDeviceInfo(req) {
    return {
      deviceId: req.headers['x-device-id'] || this.generateDeviceId(req),
      deviceName: req.headers['x-device-name'] || this.getDeviceName(req),
      userAgent: req.headers['user-agent'] || 'Unknown',
      ipAddress: req.ip || req.connection.remoteAddress || 'Unknown'
    };
  }

  /**
   * Generate a device ID based on request information
   * @param {Object} req - Express request object
   */
  generateDeviceId(req) {
    const userAgent = req.headers['user-agent'] || '';
    const ip = req.ip || req.connection.remoteAddress || '';
    const acceptLanguage = req.headers['accept-language'] || '';
    
    const crypto = require('crypto');
    const deviceString = `${userAgent}-${ip}-${acceptLanguage}`;
    return crypto.createHash('md5').update(deviceString).digest('hex');
  }

  /**
   * Get a human-readable device name from user agent
   * @param {Object} req - Express request object
   */
  getDeviceName(req) {
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
   * @param {Object} decoded - Decoded JWT payload
   */
  isTokenNearExpiry(decoded) {
    if (!decoded.exp) return false;
    
    const now = Math.floor(Date.now() / 1000);
    const fiveMinutes = 5 * 60;
    
    return (decoded.exp - now) <= fiveMinutes;
  }

  /**
   * Generate both access and refresh tokens for a user
   * @param {Object} user - User object
   * @param {Object} deviceInfo - Device information
   */
  async generateTokenPair(user, deviceInfo) {
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

module.exports = new JWTService();