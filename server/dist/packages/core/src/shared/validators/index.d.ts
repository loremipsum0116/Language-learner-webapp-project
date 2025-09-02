import { z } from 'zod';
import { CEFRLevel, PartOfSpeech } from '@shared/types';
export declare const emailSchema: z.ZodString;
export declare const passwordSchema: z.ZodString;
export declare const userRoleSchema: z.ZodEnum<["USER", "ADMIN"]>;
export declare const cefrLevelSchema: z.ZodEnum<["A1", "A2", "B1", "B2", "C1", "C2"]>;
export declare const partOfSpeechSchema: z.ZodEnum<["noun", "verb", "adjective", "adverb", "pronoun", "preposition", "conjunction", "interjection", "article", "other"]>;
export declare const exampleKindSchema: z.ZodEnum<["gloss", "example", "usage"]>;
export declare const userPreferencesSchema: z.ZodObject<{
    dailyGoal: z.ZodOptional<z.ZodNumber>;
    reminderTime: z.ZodOptional<z.ZodString>;
    notifications: z.ZodOptional<z.ZodBoolean>;
    offlineSync: z.ZodOptional<z.ZodBoolean>;
    audioAutoDownload: z.ZodOptional<z.ZodBoolean>;
    theme: z.ZodOptional<z.ZodEnum<["light", "dark", "system"]>>;
    language: z.ZodOptional<z.ZodString>;
}, "passthrough", z.ZodTypeAny, z.objectOutputType<{
    dailyGoal: z.ZodOptional<z.ZodNumber>;
    reminderTime: z.ZodOptional<z.ZodString>;
    notifications: z.ZodOptional<z.ZodBoolean>;
    offlineSync: z.ZodOptional<z.ZodBoolean>;
    audioAutoDownload: z.ZodOptional<z.ZodBoolean>;
    theme: z.ZodOptional<z.ZodEnum<["light", "dark", "system"]>>;
    language: z.ZodOptional<z.ZodString>;
}, z.ZodTypeAny, "passthrough">, z.objectInputType<{
    dailyGoal: z.ZodOptional<z.ZodNumber>;
    reminderTime: z.ZodOptional<z.ZodString>;
    notifications: z.ZodOptional<z.ZodBoolean>;
    offlineSync: z.ZodOptional<z.ZodBoolean>;
    audioAutoDownload: z.ZodOptional<z.ZodBoolean>;
    theme: z.ZodOptional<z.ZodEnum<["light", "dark", "system"]>>;
    language: z.ZodOptional<z.ZodString>;
}, z.ZodTypeAny, "passthrough">>;
export declare const createUserSchema: z.ZodObject<{
    email: z.ZodString;
    password: z.ZodString;
    role: z.ZodDefault<z.ZodEnum<["USER", "ADMIN"]>>;
    preferences: z.ZodOptional<z.ZodObject<{
        dailyGoal: z.ZodOptional<z.ZodNumber>;
        reminderTime: z.ZodOptional<z.ZodString>;
        notifications: z.ZodOptional<z.ZodBoolean>;
        offlineSync: z.ZodOptional<z.ZodBoolean>;
        audioAutoDownload: z.ZodOptional<z.ZodBoolean>;
        theme: z.ZodOptional<z.ZodEnum<["light", "dark", "system"]>>;
        language: z.ZodOptional<z.ZodString>;
    }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
        dailyGoal: z.ZodOptional<z.ZodNumber>;
        reminderTime: z.ZodOptional<z.ZodString>;
        notifications: z.ZodOptional<z.ZodBoolean>;
        offlineSync: z.ZodOptional<z.ZodBoolean>;
        audioAutoDownload: z.ZodOptional<z.ZodBoolean>;
        theme: z.ZodOptional<z.ZodEnum<["light", "dark", "system"]>>;
        language: z.ZodOptional<z.ZodString>;
    }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
        dailyGoal: z.ZodOptional<z.ZodNumber>;
        reminderTime: z.ZodOptional<z.ZodString>;
        notifications: z.ZodOptional<z.ZodBoolean>;
        offlineSync: z.ZodOptional<z.ZodBoolean>;
        audioAutoDownload: z.ZodOptional<z.ZodBoolean>;
        theme: z.ZodOptional<z.ZodEnum<["light", "dark", "system"]>>;
        language: z.ZodOptional<z.ZodString>;
    }, z.ZodTypeAny, "passthrough">>>;
}, "strip", z.ZodTypeAny, {
    password?: string;
    email?: string;
    role?: "USER" | "ADMIN";
    preferences?: {
        dailyGoal?: number;
        reminderTime?: string;
        notifications?: boolean;
        offlineSync?: boolean;
        audioAutoDownload?: boolean;
        theme?: "light" | "dark" | "system";
        language?: string;
    } & {
        [k: string]: unknown;
    };
}, {
    password?: string;
    email?: string;
    role?: "USER" | "ADMIN";
    preferences?: {
        dailyGoal?: number;
        reminderTime?: string;
        notifications?: boolean;
        offlineSync?: boolean;
        audioAutoDownload?: boolean;
        theme?: "light" | "dark" | "system";
        language?: string;
    } & {
        [k: string]: unknown;
    };
}>;
export declare const updateUserSchema: z.ZodObject<{
    email: z.ZodOptional<z.ZodString>;
    role: z.ZodOptional<z.ZodEnum<["USER", "ADMIN"]>>;
    preferences: z.ZodOptional<z.ZodObject<{
        dailyGoal: z.ZodOptional<z.ZodNumber>;
        reminderTime: z.ZodOptional<z.ZodString>;
        notifications: z.ZodOptional<z.ZodBoolean>;
        offlineSync: z.ZodOptional<z.ZodBoolean>;
        audioAutoDownload: z.ZodOptional<z.ZodBoolean>;
        theme: z.ZodOptional<z.ZodEnum<["light", "dark", "system"]>>;
        language: z.ZodOptional<z.ZodString>;
    }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
        dailyGoal: z.ZodOptional<z.ZodNumber>;
        reminderTime: z.ZodOptional<z.ZodString>;
        notifications: z.ZodOptional<z.ZodBoolean>;
        offlineSync: z.ZodOptional<z.ZodBoolean>;
        audioAutoDownload: z.ZodOptional<z.ZodBoolean>;
        theme: z.ZodOptional<z.ZodEnum<["light", "dark", "system"]>>;
        language: z.ZodOptional<z.ZodString>;
    }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
        dailyGoal: z.ZodOptional<z.ZodNumber>;
        reminderTime: z.ZodOptional<z.ZodString>;
        notifications: z.ZodOptional<z.ZodBoolean>;
        offlineSync: z.ZodOptional<z.ZodBoolean>;
        audioAutoDownload: z.ZodOptional<z.ZodBoolean>;
        theme: z.ZodOptional<z.ZodEnum<["light", "dark", "system"]>>;
        language: z.ZodOptional<z.ZodString>;
    }, z.ZodTypeAny, "passthrough">>>;
    totalWords: z.ZodOptional<z.ZodNumber>;
    studyStreak: z.ZodOptional<z.ZodNumber>;
    lastStudyDate: z.ZodOptional<z.ZodDate>;
    level: z.ZodOptional<z.ZodString>;
    subscriptionType: z.ZodOptional<z.ZodString>;
    subscriptionExpiresAt: z.ZodOptional<z.ZodDate>;
}, "strip", z.ZodTypeAny, {
    level?: string;
    email?: string;
    role?: "USER" | "ADMIN";
    preferences?: {
        dailyGoal?: number;
        reminderTime?: string;
        notifications?: boolean;
        offlineSync?: boolean;
        audioAutoDownload?: boolean;
        theme?: "light" | "dark" | "system";
        language?: string;
    } & {
        [k: string]: unknown;
    };
    totalWords?: number;
    studyStreak?: number;
    lastStudyDate?: Date;
    subscriptionType?: string;
    subscriptionExpiresAt?: Date;
}, {
    level?: string;
    email?: string;
    role?: "USER" | "ADMIN";
    preferences?: {
        dailyGoal?: number;
        reminderTime?: string;
        notifications?: boolean;
        offlineSync?: boolean;
        audioAutoDownload?: boolean;
        theme?: "light" | "dark" | "system";
        language?: string;
    } & {
        [k: string]: unknown;
    };
    totalWords?: number;
    studyStreak?: number;
    lastStudyDate?: Date;
    subscriptionType?: string;
    subscriptionExpiresAt?: Date;
}>;
export declare const loginSchema: z.ZodObject<{
    email: z.ZodString;
    password: z.ZodString;
}, "strip", z.ZodTypeAny, {
    password?: string;
    email?: string;
}, {
    password?: string;
    email?: string;
}>;
export declare const createVocabSchema: z.ZodObject<{
    lemma: z.ZodString;
    pos: z.ZodEnum<["noun", "verb", "adjective", "adverb", "pronoun", "preposition", "conjunction", "interjection", "article", "other"]>;
    levelCEFR: z.ZodEnum<["A1", "A2", "B1", "B2", "C1", "C2"]>;
    frequency: z.ZodOptional<z.ZodNumber>;
    source: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    lemma?: string;
    pos?: "noun" | "verb" | "adjective" | "adverb" | "pronoun" | "preposition" | "conjunction" | "interjection" | "article" | "other";
    levelCEFR?: "A1" | "A2" | "B1" | "B2" | "C1" | "C2";
    frequency?: number;
    source?: string;
}, {
    lemma?: string;
    pos?: "noun" | "verb" | "adjective" | "adverb" | "pronoun" | "preposition" | "conjunction" | "interjection" | "article" | "other";
    levelCEFR?: "A1" | "A2" | "B1" | "B2" | "C1" | "C2";
    frequency?: number;
    source?: string;
}>;
export declare const updateVocabSchema: z.ZodObject<{
    lemma: z.ZodOptional<z.ZodString>;
    pos: z.ZodOptional<z.ZodEnum<["noun", "verb", "adjective", "adverb", "pronoun", "preposition", "conjunction", "interjection", "article", "other"]>>;
    levelCEFR: z.ZodOptional<z.ZodEnum<["A1", "A2", "B1", "B2", "C1", "C2"]>>;
    frequency: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
    source: z.ZodOptional<z.ZodOptional<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    lemma?: string;
    pos?: "noun" | "verb" | "adjective" | "adverb" | "pronoun" | "preposition" | "conjunction" | "interjection" | "article" | "other";
    levelCEFR?: "A1" | "A2" | "B1" | "B2" | "C1" | "C2";
    frequency?: number;
    source?: string;
}, {
    lemma?: string;
    pos?: "noun" | "verb" | "adjective" | "adverb" | "pronoun" | "preposition" | "conjunction" | "interjection" | "article" | "other";
    levelCEFR?: "A1" | "A2" | "B1" | "B2" | "C1" | "C2";
    frequency?: number;
    source?: string;
}>;
export declare const dictEntrySchema: z.ZodObject<{
    definition: z.ZodOptional<z.ZodString>;
    pronunciation: z.ZodOptional<z.ZodString>;
    audioLocal: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    definition?: string;
    pronunciation?: string;
    audioLocal?: string;
}, {
    definition?: string;
    pronunciation?: string;
    audioLocal?: string;
}>;
export declare const exampleSchema: z.ZodObject<{
    kind: z.ZodEnum<["gloss", "example", "usage"]>;
    en: z.ZodString;
    ko: z.ZodOptional<z.ZodString>;
    chirpScript: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    kind?: "gloss" | "example" | "usage";
    en?: string;
    ko?: string;
    chirpScript?: string;
}, {
    kind?: "gloss" | "example" | "usage";
    en?: string;
    ko?: string;
    chirpScript?: string;
}>;
export declare const createSrsCardSchema: z.ZodObject<{
    userId: z.ZodNumber;
    vocabId: z.ZodNumber;
    level: z.ZodDefault<z.ZodNumber>;
    status: z.ZodDefault<z.ZodString>;
    nextDue: z.ZodDefault<z.ZodDate>;
}, "strip", z.ZodTypeAny, {
    level?: number;
    status?: string;
    userId?: number;
    vocabId?: number;
    nextDue?: Date;
}, {
    level?: number;
    status?: string;
    userId?: number;
    vocabId?: number;
    nextDue?: Date;
}>;
export declare const updateSrsCardSchema: z.ZodObject<{
    level: z.ZodOptional<z.ZodNumber>;
    status: z.ZodOptional<z.ZodString>;
    nextDue: z.ZodOptional<z.ZodDate>;
    lastStudied: z.ZodOptional<z.ZodDate>;
    correctCount: z.ZodOptional<z.ZodNumber>;
    incorrectCount: z.ZodOptional<z.ZodNumber>;
    totalResponseTime: z.ZodOptional<z.ZodNumber>;
    totalStudyTime: z.ZodOptional<z.ZodNumber>;
    studyCount: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    level?: number;
    status?: string;
    nextDue?: Date;
    lastStudied?: Date;
    correctCount?: number;
    incorrectCount?: number;
    totalResponseTime?: number;
    totalStudyTime?: number;
    studyCount?: number;
}, {
    level?: number;
    status?: string;
    nextDue?: Date;
    lastStudied?: Date;
    correctCount?: number;
    incorrectCount?: number;
    totalResponseTime?: number;
    totalStudyTime?: number;
    studyCount?: number;
}>;
export declare const srsReviewResultSchema: z.ZodObject<{
    cardId: z.ZodNumber;
    correct: z.ZodBoolean;
    responseTime: z.ZodOptional<z.ZodNumber>;
    studyTime: z.ZodOptional<z.ZodNumber>;
    difficulty: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    cardId?: number;
    correct?: boolean;
    responseTime?: number;
    studyTime?: number;
    difficulty?: string;
}, {
    cardId?: number;
    correct?: boolean;
    responseTime?: number;
    studyTime?: number;
    difficulty?: string;
}>;
export declare const batchSrsReviewSchema: z.ZodObject<{
    completions: z.ZodArray<z.ZodObject<{
        cardId: z.ZodNumber;
        correct: z.ZodBoolean;
        responseTime: z.ZodOptional<z.ZodNumber>;
        studyTime: z.ZodOptional<z.ZodNumber>;
        difficulty: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        cardId?: number;
        correct?: boolean;
        responseTime?: number;
        studyTime?: number;
        difficulty?: string;
    }, {
        cardId?: number;
        correct?: boolean;
        responseTime?: number;
        studyTime?: number;
        difficulty?: string;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    completions?: {
        cardId?: number;
        correct?: boolean;
        responseTime?: number;
        studyTime?: number;
        difficulty?: string;
    }[];
}, {
    completions?: {
        cardId?: number;
        correct?: boolean;
        responseTime?: number;
        studyTime?: number;
        difficulty?: string;
    }[];
}>;
export declare const createProgressSchema: z.ZodObject<{
    userId: z.ZodNumber;
    vocabId: z.ZodNumber;
    isLearned: z.ZodDefault<z.ZodBoolean>;
    difficulty: z.ZodDefault<z.ZodString>;
    studyCount: z.ZodDefault<z.ZodNumber>;
    totalStudyTime: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    userId?: number;
    vocabId?: number;
    totalStudyTime?: number;
    studyCount?: number;
    difficulty?: string;
    isLearned?: boolean;
}, {
    userId?: number;
    vocabId?: number;
    totalStudyTime?: number;
    studyCount?: number;
    difficulty?: string;
    isLearned?: boolean;
}>;
export declare const updateProgressSchema: z.ZodObject<{
    isLearned: z.ZodOptional<z.ZodBoolean>;
    difficulty: z.ZodOptional<z.ZodString>;
    lastStudiedAt: z.ZodOptional<z.ZodDate>;
    studyCount: z.ZodOptional<z.ZodNumber>;
    totalStudyTime: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    totalStudyTime?: number;
    studyCount?: number;
    difficulty?: string;
    isLearned?: boolean;
    lastStudiedAt?: Date;
}, {
    totalStudyTime?: number;
    studyCount?: number;
    difficulty?: string;
    isLearned?: boolean;
    lastStudiedAt?: Date;
}>;
export declare const batchProgressUpdateSchema: z.ZodObject<{
    updates: z.ZodArray<z.ZodObject<{
        vocabId: z.ZodNumber;
        isLearned: z.ZodOptional<z.ZodBoolean>;
        difficulty: z.ZodOptional<z.ZodString>;
        studyTime: z.ZodOptional<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        vocabId?: number;
        studyTime?: number;
        difficulty?: string;
        isLearned?: boolean;
    }, {
        vocabId?: number;
        studyTime?: number;
        difficulty?: string;
        isLearned?: boolean;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    updates?: {
        vocabId?: number;
        studyTime?: number;
        difficulty?: string;
        isLearned?: boolean;
    }[];
}, {
    updates?: {
        vocabId?: number;
        studyTime?: number;
        difficulty?: string;
        isLearned?: boolean;
    }[];
}>;
export declare const createCategorySchema: z.ZodObject<{
    name: z.ZodString;
    color: z.ZodOptional<z.ZodString>;
    description: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    name?: string;
    color?: string;
    description?: string;
}, {
    name?: string;
    color?: string;
    description?: string;
}>;
export declare const updateCategorySchema: z.ZodObject<{
    name: z.ZodOptional<z.ZodString>;
    color: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    name?: string;
    color?: string;
    description?: string;
}, {
    name?: string;
    color?: string;
    description?: string;
}>;
export declare const quizAnswerSchema: z.ZodObject<{
    questionId: z.ZodNumber;
    selectedAnswer: z.ZodString;
    responseTime: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    responseTime?: number;
    questionId?: number;
    selectedAnswer?: string;
}, {
    responseTime?: number;
    questionId?: number;
    selectedAnswer?: string;
}>;
export declare const quizSubmissionSchema: z.ZodObject<{
    answers: z.ZodArray<z.ZodObject<{
        questionId: z.ZodNumber;
        selectedAnswer: z.ZodString;
        responseTime: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        responseTime?: number;
        questionId?: number;
        selectedAnswer?: string;
    }, {
        responseTime?: number;
        questionId?: number;
        selectedAnswer?: string;
    }>, "many">;
    sessionId: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    answers?: {
        responseTime?: number;
        questionId?: number;
        selectedAnswer?: string;
    }[];
    sessionId?: string;
}, {
    answers?: {
        responseTime?: number;
        questionId?: number;
        selectedAnswer?: string;
    }[];
    sessionId?: string;
}>;
export declare const paginationSchema: z.ZodObject<{
    offset: z.ZodDefault<z.ZodNumber>;
    limit: z.ZodDefault<z.ZodNumber>;
    sortBy: z.ZodOptional<z.ZodString>;
    sortOrder: z.ZodDefault<z.ZodEnum<["asc", "desc"]>>;
}, "strip", z.ZodTypeAny, {
    offset?: number;
    limit?: number;
    sortBy?: string;
    sortOrder?: "asc" | "desc";
}, {
    offset?: number;
    limit?: number;
    sortBy?: string;
    sortOrder?: "asc" | "desc";
}>;
export declare const searchSchema: z.ZodObject<{
    q: z.ZodString;
    categories: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    levels: z.ZodOptional<z.ZodArray<z.ZodEnum<["A1", "A2", "B1", "B2", "C1", "C2"]>, "many">>;
    pos: z.ZodOptional<z.ZodArray<z.ZodEnum<["noun", "verb", "adjective", "adverb", "pronoun", "preposition", "conjunction", "interjection", "article", "other"]>, "many">>;
}, "strip", z.ZodTypeAny, {
    pos?: ("noun" | "verb" | "adjective" | "adverb" | "pronoun" | "preposition" | "conjunction" | "interjection" | "article" | "other")[];
    q?: string;
    categories?: string[];
    levels?: ("A1" | "A2" | "B1" | "B2" | "C1" | "C2")[];
}, {
    pos?: ("noun" | "verb" | "adjective" | "adverb" | "pronoun" | "preposition" | "conjunction" | "interjection" | "article" | "other")[];
    q?: string;
    categories?: string[];
    levels?: ("A1" | "A2" | "B1" | "B2" | "C1" | "C2")[];
}>;
export declare const deviceInfoSchema: z.ZodObject<{
    platform: z.ZodOptional<z.ZodString>;
    appVersion: z.ZodOptional<z.ZodString>;
    deviceModel: z.ZodOptional<z.ZodString>;
    osVersion: z.ZodOptional<z.ZodString>;
    userAgent: z.ZodOptional<z.ZodString>;
    deviceId: z.ZodOptional<z.ZodString>;
    isMobile: z.ZodOptional<z.ZodBoolean>;
    isNativeApp: z.ZodOptional<z.ZodBoolean>;
}, "passthrough", z.ZodTypeAny, z.objectOutputType<{
    platform: z.ZodOptional<z.ZodString>;
    appVersion: z.ZodOptional<z.ZodString>;
    deviceModel: z.ZodOptional<z.ZodString>;
    osVersion: z.ZodOptional<z.ZodString>;
    userAgent: z.ZodOptional<z.ZodString>;
    deviceId: z.ZodOptional<z.ZodString>;
    isMobile: z.ZodOptional<z.ZodBoolean>;
    isNativeApp: z.ZodOptional<z.ZodBoolean>;
}, z.ZodTypeAny, "passthrough">, z.objectInputType<{
    platform: z.ZodOptional<z.ZodString>;
    appVersion: z.ZodOptional<z.ZodString>;
    deviceModel: z.ZodOptional<z.ZodString>;
    osVersion: z.ZodOptional<z.ZodString>;
    userAgent: z.ZodOptional<z.ZodString>;
    deviceId: z.ZodOptional<z.ZodString>;
    isMobile: z.ZodOptional<z.ZodBoolean>;
    isNativeApp: z.ZodOptional<z.ZodBoolean>;
}, z.ZodTypeAny, "passthrough">>;
export declare const mobileLoginSchema: z.ZodObject<{
    email: z.ZodString;
    password: z.ZodString;
    deviceInfo: z.ZodOptional<z.ZodObject<{
        platform: z.ZodOptional<z.ZodString>;
        appVersion: z.ZodOptional<z.ZodString>;
        deviceModel: z.ZodOptional<z.ZodString>;
        osVersion: z.ZodOptional<z.ZodString>;
        userAgent: z.ZodOptional<z.ZodString>;
        deviceId: z.ZodOptional<z.ZodString>;
        isMobile: z.ZodOptional<z.ZodBoolean>;
        isNativeApp: z.ZodOptional<z.ZodBoolean>;
    }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
        platform: z.ZodOptional<z.ZodString>;
        appVersion: z.ZodOptional<z.ZodString>;
        deviceModel: z.ZodOptional<z.ZodString>;
        osVersion: z.ZodOptional<z.ZodString>;
        userAgent: z.ZodOptional<z.ZodString>;
        deviceId: z.ZodOptional<z.ZodString>;
        isMobile: z.ZodOptional<z.ZodBoolean>;
        isNativeApp: z.ZodOptional<z.ZodBoolean>;
    }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
        platform: z.ZodOptional<z.ZodString>;
        appVersion: z.ZodOptional<z.ZodString>;
        deviceModel: z.ZodOptional<z.ZodString>;
        osVersion: z.ZodOptional<z.ZodString>;
        userAgent: z.ZodOptional<z.ZodString>;
        deviceId: z.ZodOptional<z.ZodString>;
        isMobile: z.ZodOptional<z.ZodBoolean>;
        isNativeApp: z.ZodOptional<z.ZodBoolean>;
    }, z.ZodTypeAny, "passthrough">>>;
}, "strip", z.ZodTypeAny, {
    password?: string;
    email?: string;
    deviceInfo?: {
        platform?: string;
        appVersion?: string;
        deviceModel?: string;
        osVersion?: string;
        userAgent?: string;
        deviceId?: string;
        isMobile?: boolean;
        isNativeApp?: boolean;
    } & {
        [k: string]: unknown;
    };
}, {
    password?: string;
    email?: string;
    deviceInfo?: {
        platform?: string;
        appVersion?: string;
        deviceModel?: string;
        osVersion?: string;
        userAgent?: string;
        deviceId?: string;
        isMobile?: boolean;
        isNativeApp?: boolean;
    } & {
        [k: string]: unknown;
    };
}>;
export declare const syncChangesSchema: z.ZodObject<{
    srsCompletions: z.ZodOptional<z.ZodArray<z.ZodObject<{
        cardId: z.ZodNumber;
        correct: z.ZodBoolean;
        responseTime: z.ZodOptional<z.ZodNumber>;
        studyTime: z.ZodOptional<z.ZodNumber>;
        difficulty: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        cardId?: number;
        correct?: boolean;
        responseTime?: number;
        studyTime?: number;
        difficulty?: string;
    }, {
        cardId?: number;
        correct?: boolean;
        responseTime?: number;
        studyTime?: number;
        difficulty?: string;
    }>, "many">>;
    progressUpdates: z.ZodOptional<z.ZodArray<z.ZodObject<{
        vocabId: z.ZodNumber;
        isLearned: z.ZodBoolean;
        difficulty: z.ZodString;
        lastStudiedAt: z.ZodDate;
        studyCount: z.ZodNumber;
        totalStudyTime: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        vocabId?: number;
        totalStudyTime?: number;
        studyCount?: number;
        difficulty?: string;
        isLearned?: boolean;
        lastStudiedAt?: Date;
    }, {
        vocabId?: number;
        totalStudyTime?: number;
        studyCount?: number;
        difficulty?: string;
        isLearned?: boolean;
        lastStudiedAt?: Date;
    }>, "many">>;
    newFolders: z.ZodOptional<z.ZodArray<z.ZodObject<{
        name: z.ZodString;
        vocabIds: z.ZodArray<z.ZodNumber, "many">;
        settings: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>;
    }, "strip", z.ZodTypeAny, {
        name?: string;
        vocabIds?: number[];
        settings?: Record<string, any>;
    }, {
        name?: string;
        vocabIds?: number[];
        settings?: Record<string, any>;
    }>, "many">>;
}, "strip", z.ZodTypeAny, {
    srsCompletions?: {
        cardId?: number;
        correct?: boolean;
        responseTime?: number;
        studyTime?: number;
        difficulty?: string;
    }[];
    progressUpdates?: {
        vocabId?: number;
        totalStudyTime?: number;
        studyCount?: number;
        difficulty?: string;
        isLearned?: boolean;
        lastStudiedAt?: Date;
    }[];
    newFolders?: {
        name?: string;
        vocabIds?: number[];
        settings?: Record<string, any>;
    }[];
}, {
    srsCompletions?: {
        cardId?: number;
        correct?: boolean;
        responseTime?: number;
        studyTime?: number;
        difficulty?: string;
    }[];
    progressUpdates?: {
        vocabId?: number;
        totalStudyTime?: number;
        studyCount?: number;
        difficulty?: string;
        isLearned?: boolean;
        lastStudiedAt?: Date;
    }[];
    newFolders?: {
        name?: string;
        vocabIds?: number[];
        settings?: Record<string, any>;
    }[];
}>;
export declare const srsAlgorithmConfigSchema: z.ZodObject<{
    initialInterval: z.ZodNumber;
    easyFactor: z.ZodNumber;
    hardFactor: z.ZodNumber;
    maxInterval: z.ZodNumber;
    minInterval: z.ZodNumber;
    graduationInterval: z.ZodNumber;
    masteryThreshold: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    initialInterval?: number;
    easyFactor?: number;
    hardFactor?: number;
    maxInterval?: number;
    minInterval?: number;
    graduationInterval?: number;
    masteryThreshold?: number;
}, {
    initialInterval?: number;
    easyFactor?: number;
    hardFactor?: number;
    maxInterval?: number;
    minInterval?: number;
    graduationInterval?: number;
    masteryThreshold?: number;
}>;
export declare const validateId: (id: any) => id is number;
export declare const validateEmail: (email: string) => boolean;
export declare const validatePassword: (password: string) => {
    valid: boolean;
    errors: string[];
};
export declare const validateCEFRLevel: (level: string) => level is CEFRLevel;
export declare const validatePartOfSpeech: (pos: string) => pos is PartOfSpeech;
export declare const sanitizeString: (str: string, maxLength?: number) => string;
export declare const sanitizeHtml: (html: string) => string;
export declare const formatValidationError: (error: z.ZodError) => {
    field: string;
    message: string;
    code: string;
}[];
export declare const createValidator: <T>(schema: z.ZodSchema<T>) => (data: unknown) => {
    success: true;
    data: T;
} | {
    success: false;
    errors: any[];
};
export declare const validateUser: (data: unknown) => {
    success: true;
    data: {
        password?: string;
        email?: string;
        role?: "USER" | "ADMIN";
        preferences?: {
            dailyGoal?: number;
            reminderTime?: string;
            notifications?: boolean;
            offlineSync?: boolean;
            audioAutoDownload?: boolean;
            theme?: "light" | "dark" | "system";
            language?: string;
        } & {
            [k: string]: unknown;
        };
    };
} | {
    success: false;
    errors: any[];
};
export declare const validateUserUpdate: (data: unknown) => {
    success: true;
    data: {
        level?: string;
        email?: string;
        role?: "USER" | "ADMIN";
        preferences?: {
            dailyGoal?: number;
            reminderTime?: string;
            notifications?: boolean;
            offlineSync?: boolean;
            audioAutoDownload?: boolean;
            theme?: "light" | "dark" | "system";
            language?: string;
        } & {
            [k: string]: unknown;
        };
        totalWords?: number;
        studyStreak?: number;
        lastStudyDate?: Date;
        subscriptionType?: string;
        subscriptionExpiresAt?: Date;
    };
} | {
    success: false;
    errors: any[];
};
export declare const validateLogin: (data: unknown) => {
    success: true;
    data: {
        password?: string;
        email?: string;
    };
} | {
    success: false;
    errors: any[];
};
export declare const validateVocab: (data: unknown) => {
    success: true;
    data: {
        lemma?: string;
        pos?: "noun" | "verb" | "adjective" | "adverb" | "pronoun" | "preposition" | "conjunction" | "interjection" | "article" | "other";
        levelCEFR?: "A1" | "A2" | "B1" | "B2" | "C1" | "C2";
        frequency?: number;
        source?: string;
    };
} | {
    success: false;
    errors: any[];
};
export declare const validateVocabUpdate: (data: unknown) => {
    success: true;
    data: {
        lemma?: string;
        pos?: "noun" | "verb" | "adjective" | "adverb" | "pronoun" | "preposition" | "conjunction" | "interjection" | "article" | "other";
        levelCEFR?: "A1" | "A2" | "B1" | "B2" | "C1" | "C2";
        frequency?: number;
        source?: string;
    };
} | {
    success: false;
    errors: any[];
};
export declare const validateSrsCard: (data: unknown) => {
    success: true;
    data: {
        level?: number;
        status?: string;
        userId?: number;
        vocabId?: number;
        nextDue?: Date;
    };
} | {
    success: false;
    errors: any[];
};
export declare const validateSrsCardUpdate: (data: unknown) => {
    success: true;
    data: {
        level?: number;
        status?: string;
        nextDue?: Date;
        lastStudied?: Date;
        correctCount?: number;
        incorrectCount?: number;
        totalResponseTime?: number;
        totalStudyTime?: number;
        studyCount?: number;
    };
} | {
    success: false;
    errors: any[];
};
export declare const validateSrsReview: (data: unknown) => {
    success: true;
    data: {
        cardId?: number;
        correct?: boolean;
        responseTime?: number;
        studyTime?: number;
        difficulty?: string;
    };
} | {
    success: false;
    errors: any[];
};
export declare const validateBatchSrsReview: (data: unknown) => {
    success: true;
    data: {
        completions?: {
            cardId?: number;
            correct?: boolean;
            responseTime?: number;
            studyTime?: number;
            difficulty?: string;
        }[];
    };
} | {
    success: false;
    errors: any[];
};
export declare const validateProgress: (data: unknown) => {
    success: true;
    data: {
        userId?: number;
        vocabId?: number;
        totalStudyTime?: number;
        studyCount?: number;
        difficulty?: string;
        isLearned?: boolean;
    };
} | {
    success: false;
    errors: any[];
};
export declare const validateProgressUpdate: (data: unknown) => {
    success: true;
    data: {
        totalStudyTime?: number;
        studyCount?: number;
        difficulty?: string;
        isLearned?: boolean;
        lastStudiedAt?: Date;
    };
} | {
    success: false;
    errors: any[];
};
export declare const validateBatchProgressUpdate: (data: unknown) => {
    success: true;
    data: {
        updates?: {
            vocabId?: number;
            studyTime?: number;
            difficulty?: string;
            isLearned?: boolean;
        }[];
    };
} | {
    success: false;
    errors: any[];
};
export declare const validateCategory: (data: unknown) => {
    success: true;
    data: {
        name?: string;
        color?: string;
        description?: string;
    };
} | {
    success: false;
    errors: any[];
};
export declare const validateCategoryUpdate: (data: unknown) => {
    success: true;
    data: {
        name?: string;
        color?: string;
        description?: string;
    };
} | {
    success: false;
    errors: any[];
};
export declare const validateQuizSubmission: (data: unknown) => {
    success: true;
    data: {
        answers?: {
            responseTime?: number;
            questionId?: number;
            selectedAnswer?: string;
        }[];
        sessionId?: string;
    };
} | {
    success: false;
    errors: any[];
};
export declare const validatePagination: (data: unknown) => {
    success: true;
    data: {
        offset?: number;
        limit?: number;
        sortBy?: string;
        sortOrder?: "asc" | "desc";
    };
} | {
    success: false;
    errors: any[];
};
export declare const validateSearch: (data: unknown) => {
    success: true;
    data: {
        pos?: ("noun" | "verb" | "adjective" | "adverb" | "pronoun" | "preposition" | "conjunction" | "interjection" | "article" | "other")[];
        q?: string;
        categories?: string[];
        levels?: ("A1" | "A2" | "B1" | "B2" | "C1" | "C2")[];
    };
} | {
    success: false;
    errors: any[];
};
export declare const validateMobileLogin: (data: unknown) => {
    success: true;
    data: {
        password?: string;
        email?: string;
        deviceInfo?: {
            platform?: string;
            appVersion?: string;
            deviceModel?: string;
            osVersion?: string;
            userAgent?: string;
            deviceId?: string;
            isMobile?: boolean;
            isNativeApp?: boolean;
        } & {
            [k: string]: unknown;
        };
    };
} | {
    success: false;
    errors: any[];
};
export declare const validateSyncChanges: (data: unknown) => {
    success: true;
    data: {
        srsCompletions?: {
            cardId?: number;
            correct?: boolean;
            responseTime?: number;
            studyTime?: number;
            difficulty?: string;
        }[];
        progressUpdates?: {
            vocabId?: number;
            totalStudyTime?: number;
            studyCount?: number;
            difficulty?: string;
            isLearned?: boolean;
            lastStudiedAt?: Date;
        }[];
        newFolders?: {
            name?: string;
            vocabIds?: number[];
            settings?: Record<string, any>;
        }[];
    };
} | {
    success: false;
    errors: any[];
};
export declare const validateSrsAlgorithmConfig: (data: unknown) => {
    success: true;
    data: {
        initialInterval?: number;
        easyFactor?: number;
        hardFactor?: number;
        maxInterval?: number;
        minInterval?: number;
        graduationInterval?: number;
        masteryThreshold?: number;
    };
} | {
    success: false;
    errors: any[];
};
//# sourceMappingURL=index.d.ts.map