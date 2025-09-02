"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const bcrypt_1 = __importDefault(require("bcrypt"));
const prismaClient_1 = require("../lib/prismaClient");
class AuthService {
    static async authenticateUser(email, password) {
        try {
            const user = await prismaClient_1.prisma.user.findUnique({
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
            const isValidPassword = await bcrypt_1.default.compare(password, user.passwordHash);
            if (!isValidPassword) {
                return null;
            }
            const { passwordHash: _, ...userWithoutPassword } = user;
            return userWithoutPassword;
        }
        catch (error) {
            console.error('[AUTH SERVICE] Authenticate error:', error);
            throw error;
        }
    }
    static async findUserByEmail(email) {
        try {
            return await prismaClient_1.prisma.user.findUnique({
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
        }
        catch (error) {
            console.error('[AUTH SERVICE] Find user by email error:', error);
            throw error;
        }
    }
    static async findUserById(userId) {
        try {
            return await prismaClient_1.prisma.user.findUnique({
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
        }
        catch (error) {
            console.error('[AUTH SERVICE] Find user by ID error:', error);
            throw error;
        }
    }
    static async createUser(userData) {
        try {
            const { email, password, profile } = userData;
            const saltRounds = 12;
            const hashedPassword = await bcrypt_1.default.hash(password, saltRounds);
            const newUser = await prismaClient_1.prisma.user.create({
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
        }
        catch (error) {
            console.error('[AUTH SERVICE] Create user error:', error);
            throw error;
        }
    }
    static async updatePassword(userId, newPassword) {
        try {
            const saltRounds = 12;
            const hashedPassword = await bcrypt_1.default.hash(newPassword, saltRounds);
            await prismaClient_1.prisma.user.update({
                where: { id: userId },
                data: { passwordHash: hashedPassword }
            });
            return true;
        }
        catch (error) {
            console.error('[AUTH SERVICE] Update password error:', error);
            throw error;
        }
    }
    static async updateProfile(userId, profile) {
        try {
            const updatedUser = await prismaClient_1.prisma.user.update({
                where: { id: userId },
                data: { profile },
                select: {
                    id: true,
                    profile: true
                }
            });
            return updatedUser;
        }
        catch (error) {
            console.error('[AUTH SERVICE] Update profile error:', error);
            throw error;
        }
    }
    static async updateLastStudied(userId) {
        try {
            await prismaClient_1.prisma.user.update({
                where: { id: userId },
                data: { lastStudiedAt: new Date() }
            });
        }
        catch (error) {
            console.error('[AUTH SERVICE] Update last studied error:', error);
            throw error;
        }
    }
    static async deleteUser(userId) {
        try {
            await prismaClient_1.prisma.user.update({
                where: { id: userId },
                data: {
                    email: `deleted_${userId}@deleted.com`
                }
            });
            return true;
        }
        catch (error) {
            console.error('[AUTH SERVICE] Delete user error:', error);
            throw error;
        }
    }
    static async getUserStats(userId) {
        try {
            const [user, totalProgress, srsStats] = await Promise.all([
                prismaClient_1.prisma.user.findUnique({
                    where: { id: userId },
                    select: {
                        streak: true,
                        lastStudiedAt: true
                    }
                }),
                prismaClient_1.prisma.uservocab.count({
                    where: { userId }
                }),
                prismaClient_1.prisma.srscard.groupBy({
                    by: ['isMastered'],
                    where: { userId },
                    _count: {
                        _all: true
                    }
                })
            ]);
            const srsStatsByStatus = srsStats.reduce((acc, stat) => {
                const key = stat.isMastered ? 'mastered' : 'available';
                acc[key] = stat._count._all;
                return acc;
            }, {});
            return {
                studyStreak: user?.streak || 0,
                totalWords: totalProgress || 0,
                level: 'Beginner',
                lastStudyDate: user?.lastStudiedAt || null,
                learnedWords: totalProgress,
                srsCards: {
                    available: srsStatsByStatus.available || 0,
                    waiting: 0,
                    mastered: srsStatsByStatus.mastered || 0
                }
            };
        }
        catch (error) {
            console.error('[AUTH SERVICE] Get user stats error:', error);
            throw error;
        }
    }
}
exports.default = AuthService;
