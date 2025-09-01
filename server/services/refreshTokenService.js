const crypto = require('crypto');
const { prisma } = require('../lib/prismaClient');

class RefreshTokenService {
  constructor() {
    // Refresh tokens expire after 30 days
    this.REFRESH_TOKEN_EXPIRY = 30 * 24 * 60 * 60 * 1000; // 30 days in milliseconds
    // Maximum number of refresh tokens per user
    this.MAX_TOKENS_PER_USER = 5;
  }

  /**
   * Generate a secure refresh token
   */
  generateRefreshToken() {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Create a new refresh token for a user
   * @param {number} userId - The user ID
   * @param {Object} deviceInfo - Device information
   * @param {string} deviceInfo.deviceId - Unique device identifier
   * @param {string} deviceInfo.deviceName - Human-readable device name
   * @param {string} deviceInfo.userAgent - Browser/app user agent
   * @param {string} deviceInfo.ipAddress - Client IP address
   */
  async createRefreshToken(userId, deviceInfo = {}) {
    const token = this.generateRefreshToken();
    const expiresAt = new Date(Date.now() + this.REFRESH_TOKEN_EXPIRY);

    try {
      // Clean up expired tokens for this user
      await this.cleanupExpiredTokens(userId);
      
      // Check if we need to remove old tokens (keep only MAX_TOKENS_PER_USER)
      await this.enforceTokenLimit(userId);

      // Create new refresh token
      const refreshToken = await prisma.refreshToken.create({
        data: {
          userId,
          token,
          deviceId: deviceInfo.deviceId,
          deviceName: deviceInfo.deviceName,
          userAgent: deviceInfo.userAgent,
          ipAddress: deviceInfo.ipAddress,
          expiresAt,
          lastUsedAt: new Date()
        }
      });

      return {
        token: refreshToken.token,
        expiresAt: refreshToken.expiresAt
      };
    } catch (error) {
      console.error('Error creating refresh token:', error);
      throw new Error('Failed to create refresh token');
    }
  }

  /**
   * Validate and refresh a token
   * @param {string} token - The refresh token to validate
   */
  async validateRefreshToken(token) {
    try {
      const refreshToken = await prisma.refreshToken.findUnique({
        where: { token },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              role: true
            }
          }
        }
      });

      if (!refreshToken) {
        throw new Error('Invalid refresh token');
      }

      if (refreshToken.isRevoked) {
        throw new Error('Refresh token has been revoked');
      }

      if (new Date() > refreshToken.expiresAt) {
        // Clean up expired token
        await this.revokeRefreshToken(token);
        throw new Error('Refresh token has expired');
      }

      // Update last used time
      await prisma.refreshToken.update({
        where: { id: refreshToken.id },
        data: { lastUsedAt: new Date() }
      });

      return {
        user: refreshToken.user,
        tokenId: refreshToken.id,
        deviceId: refreshToken.deviceId
      };
    } catch (error) {
      console.error('Error validating refresh token:', error);
      throw error;
    }
  }

  /**
   * Revoke a specific refresh token
   * @param {string} token - The refresh token to revoke
   */
  async revokeRefreshToken(token) {
    try {
      await prisma.refreshToken.update({
        where: { token },
        data: {
          isRevoked: true,
          revokedAt: new Date()
        }
      });
    } catch (error) {
      console.error('Error revoking refresh token:', error);
      throw new Error('Failed to revoke refresh token');
    }
  }

  /**
   * Revoke all refresh tokens for a user
   * @param {number} userId - The user ID
   */
  async revokeAllUserTokens(userId) {
    try {
      await prisma.refreshToken.updateMany({
        where: {
          userId,
          isRevoked: false
        },
        data: {
          isRevoked: true,
          revokedAt: new Date()
        }
      });
    } catch (error) {
      console.error('Error revoking all user tokens:', error);
      throw new Error('Failed to revoke all user tokens');
    }
  }

  /**
   * Get all active refresh tokens for a user (for device management)
   * @param {number} userId - The user ID
   */
  async getUserActiveTokens(userId) {
    try {
      const tokens = await prisma.refreshToken.findMany({
        where: {
          userId,
          isRevoked: false,
          expiresAt: {
            gt: new Date()
          }
        },
        select: {
          id: true,
          deviceId: true,
          deviceName: true,
          userAgent: true,
          ipAddress: true,
          createdAt: true,
          lastUsedAt: true,
          expiresAt: true
        },
        orderBy: {
          lastUsedAt: 'desc'
        }
      });

      return tokens;
    } catch (error) {
      console.error('Error getting user active tokens:', error);
      throw new Error('Failed to get user active tokens');
    }
  }

  /**
   * Clean up expired refresh tokens for a user
   * @param {number} userId - The user ID
   */
  async cleanupExpiredTokens(userId) {
    try {
      await prisma.refreshToken.deleteMany({
        where: {
          userId,
          OR: [
            { expiresAt: { lt: new Date() } },
            { isRevoked: true }
          ]
        }
      });
    } catch (error) {
      console.error('Error cleaning up expired tokens:', error);
    }
  }

  /**
   * Enforce maximum number of tokens per user
   * @param {number} userId - The user ID
   */
  async enforceTokenLimit(userId) {
    try {
      const tokenCount = await prisma.refreshToken.count({
        where: {
          userId,
          isRevoked: false,
          expiresAt: { gt: new Date() }
        }
      });

      if (tokenCount >= this.MAX_TOKENS_PER_USER) {
        // Get the oldest tokens and revoke them
        const oldestTokens = await prisma.refreshToken.findMany({
          where: {
            userId,
            isRevoked: false,
            expiresAt: { gt: new Date() }
          },
          orderBy: {
            lastUsedAt: 'asc'
          },
          take: tokenCount - this.MAX_TOKENS_PER_USER + 1
        });

        const tokensToRevoke = oldestTokens.map(t => t.id);
        
        await prisma.refreshToken.updateMany({
          where: {
            id: { in: tokensToRevoke }
          },
          data: {
            isRevoked: true,
            revokedAt: new Date()
          }
        });
      }
    } catch (error) {
      console.error('Error enforcing token limit:', error);
    }
  }

  /**
   * Global cleanup of expired tokens (for cron job)
   */
  async globalCleanup() {
    try {
      const result = await prisma.refreshToken.deleteMany({
        where: {
          OR: [
            { expiresAt: { lt: new Date() } },
            { 
              isRevoked: true,
              revokedAt: { lt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } // 7 days old
            }
          ]
        }
      });

      console.log(`Cleaned up ${result.count} expired refresh tokens`);
      return result.count;
    } catch (error) {
      console.error('Error during global token cleanup:', error);
      throw error;
    }
  }
}

module.exports = new RefreshTokenService();