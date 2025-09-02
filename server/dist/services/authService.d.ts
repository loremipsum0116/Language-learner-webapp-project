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
declare class AuthService {
    static authenticateUser(email: string, password: string): Promise<{
        id: number;
        email: string;
        role: string;
        createdAt: Date;
        lastStudiedAt: Date;
        profile: import("@prisma/client/runtime/library").JsonValue;
        streak: number;
    }>;
    static findUserByEmail(email: string): Promise<{
        id: number;
        email: string;
        role: string;
        createdAt: Date;
        lastStudiedAt: Date;
        profile: import("@prisma/client/runtime/library").JsonValue;
        streak: number;
    }>;
    static findUserById(userId: number): Promise<{
        id: number;
        email: string;
        role: string;
        createdAt: Date;
        lastStudiedAt: Date;
        profile: import("@prisma/client/runtime/library").JsonValue;
        streak: number;
        streakUpdatedAt: Date;
        dailyQuizCount: number;
        lastQuizDate: Date;
    }>;
    static createUser(userData: CreateUserInput): Promise<{
        id: number;
        email: string;
        role: string;
        createdAt: Date;
        lastStudiedAt: Date;
        profile: import("@prisma/client/runtime/library").JsonValue;
        streak: number;
    }>;
    static updatePassword(userId: number, newPassword: string): Promise<boolean>;
    static updateProfile(userId: number, profile: any): Promise<{
        id: number;
        profile: import("@prisma/client/runtime/library").JsonValue;
    }>;
    static updateLastStudied(userId: number): Promise<void>;
    static deleteUser(userId: number): Promise<boolean>;
    static getUserStats(userId: number): Promise<UserStats>;
}
export default AuthService;
//# sourceMappingURL=authService.d.ts.map