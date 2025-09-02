// services/authService.ts
import bcrypt from 'bcrypt';
import { prisma } from '../lib/prismaClient';

interface UserStats {
  studyStreak: number;
  totalWords: number;
  level: string;
  lastStudyDate: Date | null;
  learnedWords: number;
  srsCards: {
    available: number;
    waiting: number;
    mastered: number;
  };
}

interface CreateUserInput {
  email: string;
  password: string;
  profile?: any;
}

class AuthService {
  
  // 사용자 인증
  static async authenticateUser(email: string, password: string) {
    try {
      const user = await prisma.user.findUnique({
        where: { email },
        select: {
          id: true,
          email: true,
          passwordHash: true,
          role: true,
          createdAt: true,
          profile: true,
          streak: true,
          lastStudiedAt: true
        }
      });

      if (!user) {
        return null;
      }

      const isValidPassword = await bcrypt.compare(password, user.passwordHash);
      if (!isValidPassword) {
        return null;
      }

      // 패스워드 제외하고 반환
      const { passwordHash: _, ...userWithoutPassword } = user;
      return userWithoutPassword;

    } catch (error) {
      console.error('[AUTH SERVICE] Authenticate error:', error);
      throw error;
    }
  }

  // 이메일로 사용자 찾기
  static async findUserByEmail(email: string) {
    try {
      return await prisma.user.findUnique({
        where: { email },
        select: {
          id: true,
          email: true,
          role: true,
          createdAt: true,
          profile: true,
          streak: true,
          lastStudiedAt: true
        }
      });
    } catch (error) {
      console.error('[AUTH SERVICE] Find user by email error:', error);
      throw error;
    }
  }

  // ID로 사용자 찾기
  static async findUserById(userId: number) {
    try {
      return await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          role: true,
          createdAt: true,
          profile: true,
          streak: true,
          lastStudiedAt: true,
          streakUpdatedAt: true,
          dailyQuizCount: true,
          lastQuizDate: true
        }
      });
    } catch (error) {
      console.error('[AUTH SERVICE] Find user by ID error:', error);
      throw error;
    }
  }

  // 새 사용자 생성
  static async createUser(userData: CreateUserInput) {
    try {
      const { email, password, profile } = userData;
      
      // 비밀번호 해시
      const saltRounds = 12;
      const hashedPassword = await bcrypt.hash(password, saltRounds);

      const newUser = await prisma.user.create({
        data: {
          email,
          passwordHash: hashedPassword,
          role: 'USER',
          profile: profile || {},
          createdAt: new Date()
        },
        select: {
          id: true,
          email: true,
          role: true,
          createdAt: true,
          profile: true,
          streak: true,
          lastStudiedAt: true
        }
      });

      return newUser;

    } catch (error) {
      console.error('[AUTH SERVICE] Create user error:', error);
      throw error;
    }
  }

  // 사용자 비밀번호 업데이트
  static async updatePassword(userId: number, newPassword: string): Promise<boolean> {
    try {
      const saltRounds = 12;
      const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

      await prisma.user.update({
        where: { id: userId },
        data: { passwordHash: hashedPassword }
      });

      return true;
    } catch (error) {
      console.error('[AUTH SERVICE] Update password error:', error);
      throw error;
    }
  }

  // 사용자 프로필 업데이트
  static async updateProfile(userId: number, profile: any) {
    try {
      const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: { profile },
        select: {
          id: true,
          profile: true
        }
      });

      return updatedUser;
    } catch (error) {
      console.error('[AUTH SERVICE] Update profile error:', error);
      throw error;
    }
  }

  // 사용자 마지막 학습 시간 업데이트
  static async updateLastStudied(userId: number): Promise<void> {
    try {
      await prisma.user.update({
        where: { id: userId },
        data: { lastStudiedAt: new Date() }
      });
    } catch (error) {
      console.error('[AUTH SERVICE] Update last studied error:', error);
      throw error;
    }
  }

  // 사용자 삭제 (실제로는 비활성화)
  static async deleteUser(userId: number): Promise<boolean> {
    try {
      await prisma.user.update({
        where: { id: userId },
        data: { 
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
  static async getUserStats(userId: number): Promise<UserStats> {
    try {
      const [user, totalProgress, srsStats] = await Promise.all([
        prisma.user.findUnique({
          where: { id: userId },
          select: {
            streak: true,
            lastStudiedAt: true
          }
        }),
        prisma.uservocab.count({
          where: { userId }
        }),
        prisma.srscard.groupBy({
          by: ['isMastered'],
          where: { userId },
          _count: {
            _all: true
          }
        })
      ]);

      const srsStatsByStatus = srsStats.reduce((acc: Record<string, number>, stat) => {
        const key = stat.isMastered ? 'mastered' : 'available';
        acc[key] = stat._count._all;
        return acc;
      }, {});

      return {
        studyStreak: user?.streak || 0,
        totalWords: totalProgress || 0,
        level: 'Beginner', // 기본값
        lastStudyDate: user?.lastStudiedAt || null,
        learnedWords: totalProgress,
        srsCards: {
          available: srsStatsByStatus.available || 0,
          waiting: 0, // 현재 스키마에서는 waiting 상태가 없음
          mastered: srsStatsByStatus.mastered || 0
        }
      };
    } catch (error) {
      console.error('[AUTH SERVICE] Get user stats error:', error);
      throw error;
    }
  }
}

export default AuthService;