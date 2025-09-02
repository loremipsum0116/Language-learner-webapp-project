// services/authService.js
const bcrypt = require('bcrypt');
const { prisma } = require('../lib/prismaClient');

class AuthService {
  
  // 사용자 인증
  static async authenticateUser(email, password) {
    try {
      const user = await prisma.user.findUnique({
        where: { email },
        select: {
          id: true,
          email: true,
          password: true,
          role: true,
          createdAt: true,
          preferences: true
        }
      });

      if (!user) {
        return null;
      }

      const isValidPassword = await bcrypt.compare(password, user.password);
      if (!isValidPassword) {
        return null;
      }

      // 패스워드 제외하고 반환
      const { password: _, ...userWithoutPassword } = user;
      return userWithoutPassword;

    } catch (error) {
      console.error('[AUTH SERVICE] Authenticate error:', error);
      throw error;
    }
  }

  // 이메일로 사용자 찾기
  static async findUserByEmail(email) {
    try {
      return await prisma.user.findUnique({
        where: { email },
        select: {
          id: true,
          email: true,
          role: true,
          createdAt: true
        }
      });
    } catch (error) {
      console.error('[AUTH SERVICE] Find user by email error:', error);
      throw error;
    }
  }

  // ID로 사용자 찾기
  static async findUserById(userId) {
    try {
      return await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          role: true,
          createdAt: true,
          preferences: true,
          totalWords: true,
          studyStreak: true,
          lastStudyDate: true,
          level: true,
          subscriptionType: true,
          subscriptionExpiresAt: true
        }
      });
    } catch (error) {
      console.error('[AUTH SERVICE] Find user by ID error:', error);
      throw error;
    }
  }

  // 새 사용자 생성
  static async createUser(userData) {
    try {
      const { email, password, preferences, registrationSource } = userData;
      
      // 비밀번호 해시
      const saltRounds = 12;
      const hashedPassword = await bcrypt.hash(password, saltRounds);

      const newUser = await prisma.user.create({
        data: {
          email,
          password: hashedPassword,
          role: 'user',
          preferences: preferences || {},
          registrationSource: registrationSource || 'web',
          createdAt: new Date()
        },
        select: {
          id: true,
          email: true,
          role: true,
          createdAt: true,
          preferences: true
        }
      });

      return newUser;

    } catch (error) {
      console.error('[AUTH SERVICE] Create user error:', error);
      throw error;
    }
  }

  // 사용자 비밀번호 업데이트
  static async updatePassword(userId, newPassword) {
    try {
      const saltRounds = 12;
      const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

      await prisma.user.update({
        where: { id: userId },
        data: { password: hashedPassword }
      });

      return true;
    } catch (error) {
      console.error('[AUTH SERVICE] Update password error:', error);
      throw error;
    }
  }

  // 사용자 선호 설정 업데이트
  static async updatePreferences(userId, preferences) {
    try {
      const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: { preferences },
        select: {
          id: true,
          preferences: true
        }
      });

      return updatedUser;
    } catch (error) {
      console.error('[AUTH SERVICE] Update preferences error:', error);
      throw error;
    }
  }

  // 사용자 마지막 로그인 시간 업데이트
  static async updateLastLogin(userId) {
    try {
      await prisma.user.update({
        where: { id: userId },
        data: { lastLoginAt: new Date() }
      });
    } catch (error) {
      console.error('[AUTH SERVICE] Update last login error:', error);
      throw error;
    }
  }

  // 사용자 삭제 (soft delete)
  static async deleteUser(userId) {
    try {
      await prisma.user.update({
        where: { id: userId },
        data: { 
          deletedAt: new Date(),
          email: `deleted_${userId}@deleted.com` // 이메일 중복 방지
        }
      });
      
      return true;
    } catch (error) {
      console.error('[AUTH SERVICE] Delete user error:', error);
      throw error;
    }
  }

  // 사용자 통계 조회
  static async getUserStats(userId) {
    try {
      const [user, totalProgress, srsStats] = await Promise.all([
        prisma.user.findUnique({
          where: { id: userId },
          select: {
            studyStreak: true,
            totalWords: true,
            level: true,
            lastStudyDate: true
          }
        }),
        prisma.userProgress.count({
          where: { 
            userId,
            isLearned: true 
          }
        }),
        prisma.srsCard.groupBy({
          by: ['status'],
          where: { userId },
          _count: {
            _all: true
          }
        })
      ]);

      const srsStatsByStatus = srsStats.reduce((acc, stat) => {
        acc[stat.status] = stat._count._all;
        return acc;
      }, {});

      return {
        studyStreak: user?.studyStreak || 0,
        totalWords: user?.totalWords || 0,
        level: user?.level || 'Beginner',
        lastStudyDate: user?.lastStudyDate,
        learnedWords: totalProgress,
        srsCards: {
          available: srsStatsByStatus.AVAILABLE || 0,
          waiting: srsStatsByStatus.WAITING || 0,
          mastered: srsStatsByStatus.MASTERED || 0
        }
      };
    } catch (error) {
      console.error('[AUTH SERVICE] Get user stats error:', error);
      throw error;
    }
  }
}

module.exports = AuthService;