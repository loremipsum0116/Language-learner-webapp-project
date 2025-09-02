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
    email: string;
    role: "USER" | "ADMIN";
    password: string;
    preferences?: z.objectOutputType<{
        dailyGoal: z.ZodOptional<z.ZodNumber>;
        reminderTime: z.ZodOptional<z.ZodString>;
        notifications: z.ZodOptional<z.ZodBoolean>;
        offlineSync: z.ZodOptional<z.ZodBoolean>;
        audioAutoDownload: z.ZodOptional<z.ZodBoolean>;
        theme: z.ZodOptional<z.ZodEnum<["light", "dark", "system"]>>;
        language: z.ZodOptional<z.ZodString>;
    }, z.ZodTypeAny, "passthrough"> | undefined;
}, {
    email: string;
    password: string;
    role?: "USER" | "ADMIN" | undefined;
    preferences?: z.objectInputType<{
        dailyGoal: z.ZodOptional<z.ZodNumber>;
        reminderTime: z.ZodOptional<z.ZodString>;
        notifications: z.ZodOptional<z.ZodBoolean>;
        offlineSync: z.ZodOptional<z.ZodBoolean>;
        audioAutoDownload: z.ZodOptional<z.ZodBoolean>;
        theme: z.ZodOptional<z.ZodEnum<["light", "dark", "system"]>>;
        language: z.ZodOptional<z.ZodString>;
    }, z.ZodTypeAny, "passthrough"> | undefined;
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
    email?: string | undefined;
    role?: "USER" | "ADMIN" | undefined;
    preferences?: z.objectOutputType<{
        dailyGoal: z.ZodOptional<z.ZodNumber>;
        reminderTime: z.ZodOptional<z.ZodString>;
        notifications: z.ZodOptional<z.ZodBoolean>;
        offlineSync: z.ZodOptional<z.ZodBoolean>;
        audioAutoDownload: z.ZodOptional<z.ZodBoolean>;
        theme: z.ZodOptional<z.ZodEnum<["light", "dark", "system"]>>;
        language: z.ZodOptional<z.ZodString>;
    }, z.ZodTypeAny, "passthrough"> | undefined;
    totalWords?: number | undefined;
    studyStreak?: number | undefined;
    lastStudyDate?: Date | undefined;
    level?: string | undefined;
    subscriptionType?: string | undefined;
    subscriptionExpiresAt?: Date | undefined;
}, {
    email?: string | undefined;
    role?: "USER" | "ADMIN" | undefined;
    preferences?: z.objectInputType<{
        dailyGoal: z.ZodOptional<z.ZodNumber>;
        reminderTime: z.ZodOptional<z.ZodString>;
        notifications: z.ZodOptional<z.ZodBoolean>;
        offlineSync: z.ZodOptional<z.ZodBoolean>;
        audioAutoDownload: z.ZodOptional<z.ZodBoolean>;
        theme: z.ZodOptional<z.ZodEnum<["light", "dark", "system"]>>;
        language: z.ZodOptional<z.ZodString>;
    }, z.ZodTypeAny, "passthrough"> | undefined;
    totalWords?: number | undefined;
    studyStreak?: number | undefined;
    lastStudyDate?: Date | undefined;
    level?: string | undefined;
    subscriptionType?: string | undefined;
    subscriptionExpiresAt?: Date | undefined;
}>;
export declare const loginSchema: z.ZodObject<{
    email: z.ZodString;
    password: z.ZodString;
}, "strip", z.ZodTypeAny, {
    email: string;
    password: string;
}, {
    email: string;
    password: string;
}>;
export declare const createVocabSchema: z.ZodObject<{
    lemma: z.ZodString;
    pos: z.ZodEnum<["noun", "verb", "adjective", "adverb", "pronoun", "preposition", "conjunction", "interjection", "article", "other"]>;
    levelCEFR: z.ZodEnum<["A1", "A2", "B1", "B2", "C1", "C2"]>;
    frequency: z.ZodOptional<z.ZodNumber>;
    source: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    lemma: string;
    pos: "noun" | "verb" | "adjective" | "adverb" | "pronoun" | "preposition" | "conjunction" | "interjection" | "article" | "other";
    levelCEFR: "A1" | "A2" | "B1" | "B2" | "C1" | "C2";
    frequency?: number | undefined;
    source?: string | undefined;
}, {
    lemma: string;
    pos: "noun" | "verb" | "adjective" | "adverb" | "pronoun" | "preposition" | "conjunction" | "interjection" | "article" | "other";
    levelCEFR: "A1" | "A2" | "B1" | "B2" | "C1" | "C2";
    frequency?: number | undefined;
    source?: string | undefined;
}>;
export declare const updateVocabSchema: z.ZodObject<{
    lemma: z.ZodOptional<z.ZodString>;
    pos: z.ZodOptional<z.ZodEnum<["noun", "verb", "adjective", "adverb", "pronoun", "preposition", "conjunction", "interjection", "article", "other"]>>;
    levelCEFR: z.ZodOptional<z.ZodEnum<["A1", "A2", "B1", "B2", "C1", "C2"]>>;
    frequency: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
    source: z.ZodOptional<z.ZodOptional<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    lemma?: string | undefined;
    pos?: "noun" | "verb" | "adjective" | "adverb" | "pronoun" | "preposition" | "conjunction" | "interjection" | "article" | "other" | undefined;
    levelCEFR?: "A1" | "A2" | "B1" | "B2" | "C1" | "C2" | undefined;
    frequency?: number | undefined;
    source?: string | undefined;
}, {
    lemma?: string | undefined;
    pos?: "noun" | "verb" | "adjective" | "adverb" | "pronoun" | "preposition" | "conjunction" | "interjection" | "article" | "other" | undefined;
    levelCEFR?: "A1" | "A2" | "B1" | "B2" | "C1" | "C2" | undefined;
    frequency?: number | undefined;
    source?: string | undefined;
}>;
export declare const dictEntrySchema: z.ZodObject<{
    definition: z.ZodOptional<z.ZodString>;
    pronunciation: z.ZodOptional<z.ZodString>;
    audioLocal: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    definition?: string | undefined;
    pronunciation?: string | undefined;
    audioLocal?: string | undefined;
}, {
    definition?: string | undefined;
    pronunciation?: string | undefined;
    audioLocal?: string | undefined;
}>;
export declare const exampleSchema: z.ZodObject<{
    kind: z.ZodEnum<["gloss", "example", "usage"]>;
    en: z.ZodString;
    ko: z.ZodOptional<z.ZodString>;
    chirpScript: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    kind: "gloss" | "example" | "usage";
    en: string;
    ko?: string | undefined;
    chirpScript?: string | undefined;
}, {
    kind: "gloss" | "example" | "usage";
    en: string;
    ko?: string | undefined;
    chirpScript?: string | undefined;
}>;
export declare const createSrsCardSchema: z.ZodObject<{
    userId: z.ZodNumber;
    vocabId: z.ZodNumber;
    level: z.ZodDefault<z.ZodNumber>;
    status: z.ZodDefault<z.ZodString>;
    nextDue: z.ZodDefault<z.ZodDate>;
}, "strip", z.ZodTypeAny, {
    level: number;
    status: string;
    userId: number;
    vocabId: number;
    nextDue: Date;
}, {
    userId: number;
    vocabId: number;
    level?: number | undefined;
    status?: string | undefined;
    nextDue?: Date | undefined;
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
    level?: number | undefined;
    status?: string | undefined;
    nextDue?: Date | undefined;
    lastStudied?: Date | undefined;
    correctCount?: number | undefined;
    incorrectCount?: number | undefined;
    totalResponseTime?: number | undefined;
    totalStudyTime?: number | undefined;
    studyCount?: number | undefined;
}, {
    level?: number | undefined;
    status?: string | undefined;
    nextDue?: Date | undefined;
    lastStudied?: Date | undefined;
    correctCount?: number | undefined;
    incorrectCount?: number | undefined;
    totalResponseTime?: number | undefined;
    totalStudyTime?: number | undefined;
    studyCount?: number | undefined;
}>;
export declare const srsReviewResultSchema: z.ZodObject<{
    cardId: z.ZodNumber;
    correct: z.ZodBoolean;
    responseTime: z.ZodOptional<z.ZodNumber>;
    studyTime: z.ZodOptional<z.ZodNumber>;
    difficulty: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    cardId: number;
    correct: boolean;
    responseTime?: number | undefined;
    studyTime?: number | undefined;
    difficulty?: string | undefined;
}, {
    cardId: number;
    correct: boolean;
    responseTime?: number | undefined;
    studyTime?: number | undefined;
    difficulty?: string | undefined;
}>;
export declare const batchSrsReviewSchema: z.ZodObject<{
    completions: z.ZodArray<z.ZodObject<{
        cardId: z.ZodNumber;
        correct: z.ZodBoolean;
        responseTime: z.ZodOptional<z.ZodNumber>;
        studyTime: z.ZodOptional<z.ZodNumber>;
        difficulty: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        cardId: number;
        correct: boolean;
        responseTime?: number | undefined;
        studyTime?: number | undefined;
        difficulty?: string | undefined;
    }, {
        cardId: number;
        correct: boolean;
        responseTime?: number | undefined;
        studyTime?: number | undefined;
        difficulty?: string | undefined;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    completions: {
        cardId: number;
        correct: boolean;
        responseTime?: number | undefined;
        studyTime?: number | undefined;
        difficulty?: string | undefined;
    }[];
}, {
    completions: {
        cardId: number;
        correct: boolean;
        responseTime?: number | undefined;
        studyTime?: number | undefined;
        difficulty?: string | undefined;
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
    userId: number;
    vocabId: number;
    totalStudyTime: number;
    studyCount: number;
    difficulty: string;
    isLearned: boolean;
}, {
    userId: number;
    vocabId: number;
    totalStudyTime?: number | undefined;
    studyCount?: number | undefined;
    difficulty?: string | undefined;
    isLearned?: boolean | undefined;
}>;
export declare const updateProgressSchema: z.ZodObject<{
    isLearned: z.ZodOptional<z.ZodBoolean>;
    difficulty: z.ZodOptional<z.ZodString>;
    lastStudiedAt: z.ZodOptional<z.ZodDate>;
    studyCount: z.ZodOptional<z.ZodNumber>;
    totalStudyTime: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    totalStudyTime?: number | undefined;
    studyCount?: number | undefined;
    difficulty?: string | undefined;
    isLearned?: boolean | undefined;
    lastStudiedAt?: Date | undefined;
}, {
    totalStudyTime?: number | undefined;
    studyCount?: number | undefined;
    difficulty?: string | undefined;
    isLearned?: boolean | undefined;
    lastStudiedAt?: Date | undefined;
}>;
export declare const batchProgressUpdateSchema: z.ZodObject<{
    updates: z.ZodArray<z.ZodObject<{
        vocabId: z.ZodNumber;
        isLearned: z.ZodOptional<z.ZodBoolean>;
        difficulty: z.ZodOptional<z.ZodString>;
        studyTime: z.ZodOptional<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        vocabId: number;
        studyTime?: number | undefined;
        difficulty?: string | undefined;
        isLearned?: boolean | undefined;
    }, {
        vocabId: number;
        studyTime?: number | undefined;
        difficulty?: string | undefined;
        isLearned?: boolean | undefined;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    updates: {
        vocabId: number;
        studyTime?: number | undefined;
        difficulty?: string | undefined;
        isLearned?: boolean | undefined;
    }[];
}, {
    updates: {
        vocabId: number;
        studyTime?: number | undefined;
        difficulty?: string | undefined;
        isLearned?: boolean | undefined;
    }[];
}>;
export declare const createCategorySchema: z.ZodObject<{
    name: z.ZodString;
    color: z.ZodOptional<z.ZodString>;
    description: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    name: string;
    color?: string | undefined;
    description?: string | undefined;
}, {
    name: string;
    color?: string | undefined;
    description?: string | undefined;
}>;
export declare const updateCategorySchema: z.ZodObject<{
    name: z.ZodOptional<z.ZodString>;
    color: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    name?: string | undefined;
    color?: string | undefined;
    description?: string | undefined;
}, {
    name?: string | undefined;
    color?: string | undefined;
    description?: string | undefined;
}>;
export declare const quizAnswerSchema: z.ZodObject<{
    questionId: z.ZodNumber;
    selectedAnswer: z.ZodString;
    responseTime: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    responseTime: number;
    questionId: number;
    selectedAnswer: string;
}, {
    responseTime: number;
    questionId: number;
    selectedAnswer: string;
}>;
export declare const quizSubmissionSchema: z.ZodObject<{
    answers: z.ZodArray<z.ZodObject<{
        questionId: z.ZodNumber;
        selectedAnswer: z.ZodString;
        responseTime: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        responseTime: number;
        questionId: number;
        selectedAnswer: string;
    }, {
        responseTime: number;
        questionId: number;
        selectedAnswer: string;
    }>, "many">;
    sessionId: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    answers: {
        responseTime: number;
        questionId: number;
        selectedAnswer: string;
    }[];
    sessionId?: string | undefined;
}, {
    answers: {
        responseTime: number;
        questionId: number;
        selectedAnswer: string;
    }[];
    sessionId?: string | undefined;
}>;
export declare const paginationSchema: z.ZodObject<{
    offset: z.ZodDefault<z.ZodNumber>;
    limit: z.ZodDefault<z.ZodNumber>;
    sortBy: z.ZodOptional<z.ZodString>;
    sortOrder: z.ZodDefault<z.ZodEnum<["asc", "desc"]>>;
}, "strip", z.ZodTypeAny, {
    offset: number;
    limit: number;
    sortOrder: "asc" | "desc";
    sortBy?: string | undefined;
}, {
    offset?: number | undefined;
    limit?: number | undefined;
    sortBy?: string | undefined;
    sortOrder?: "asc" | "desc" | undefined;
}>;
export declare const searchSchema: z.ZodObject<{
    q: z.ZodString;
    categories: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    levels: z.ZodOptional<z.ZodArray<z.ZodEnum<["A1", "A2", "B1", "B2", "C1", "C2"]>, "many">>;
    pos: z.ZodOptional<z.ZodArray<z.ZodEnum<["noun", "verb", "adjective", "adverb", "pronoun", "preposition", "conjunction", "interjection", "article", "other"]>, "many">>;
}, "strip", z.ZodTypeAny, {
    q: string;
    pos?: ("noun" | "verb" | "adjective" | "adverb" | "pronoun" | "preposition" | "conjunction" | "interjection" | "article" | "other")[] | undefined;
    categories?: string[] | undefined;
    levels?: ("A1" | "A2" | "B1" | "B2" | "C1" | "C2")[] | undefined;
}, {
    q: string;
    pos?: ("noun" | "verb" | "adjective" | "adverb" | "pronoun" | "preposition" | "conjunction" | "interjection" | "article" | "other")[] | undefined;
    categories?: string[] | undefined;
    levels?: ("A1" | "A2" | "B1" | "B2" | "C1" | "C2")[] | undefined;
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
    email: string;
    password: string;
    deviceInfo?: z.objectOutputType<{
        platform: z.ZodOptional<z.ZodString>;
        appVersion: z.ZodOptional<z.ZodString>;
        deviceModel: z.ZodOptional<z.ZodString>;
        osVersion: z.ZodOptional<z.ZodString>;
        userAgent: z.ZodOptional<z.ZodString>;
        deviceId: z.ZodOptional<z.ZodString>;
        isMobile: z.ZodOptional<z.ZodBoolean>;
        isNativeApp: z.ZodOptional<z.ZodBoolean>;
    }, z.ZodTypeAny, "passthrough"> | undefined;
}, {
    email: string;
    password: string;
    deviceInfo?: z.objectInputType<{
        platform: z.ZodOptional<z.ZodString>;
        appVersion: z.ZodOptional<z.ZodString>;
        deviceModel: z.ZodOptional<z.ZodString>;
        osVersion: z.ZodOptional<z.ZodString>;
        userAgent: z.ZodOptional<z.ZodString>;
        deviceId: z.ZodOptional<z.ZodString>;
        isMobile: z.ZodOptional<z.ZodBoolean>;
        isNativeApp: z.ZodOptional<z.ZodBoolean>;
    }, z.ZodTypeAny, "passthrough"> | undefined;
}>;
export declare const syncChangesSchema: z.ZodObject<{
    srsCompletions: z.ZodOptional<z.ZodArray<z.ZodObject<{
        cardId: z.ZodNumber;
        correct: z.ZodBoolean;
        responseTime: z.ZodOptional<z.ZodNumber>;
        studyTime: z.ZodOptional<z.ZodNumber>;
        difficulty: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        cardId: number;
        correct: boolean;
        responseTime?: number | undefined;
        studyTime?: number | undefined;
        difficulty?: string | undefined;
    }, {
        cardId: number;
        correct: boolean;
        responseTime?: number | undefined;
        studyTime?: number | undefined;
        difficulty?: string | undefined;
    }>, "many">>;
    progressUpdates: z.ZodOptional<z.ZodArray<z.ZodObject<{
        vocabId: z.ZodNumber;
        isLearned: z.ZodBoolean;
        difficulty: z.ZodString;
        lastStudiedAt: z.ZodDate;
        studyCount: z.ZodNumber;
        totalStudyTime: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        vocabId: number;
        totalStudyTime: number;
        studyCount: number;
        difficulty: string;
        isLearned: boolean;
        lastStudiedAt: Date;
    }, {
        vocabId: number;
        totalStudyTime: number;
        studyCount: number;
        difficulty: string;
        isLearned: boolean;
        lastStudiedAt: Date;
    }>, "many">>;
    newFolders: z.ZodOptional<z.ZodArray<z.ZodObject<{
        name: z.ZodString;
        vocabIds: z.ZodArray<z.ZodNumber, "many">;
        settings: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>;
    }, "strip", z.ZodTypeAny, {
        name: string;
        vocabIds: number[];
        settings?: Record<string, any> | undefined;
    }, {
        name: string;
        vocabIds: number[];
        settings?: Record<string, any> | undefined;
    }>, "many">>;
}, "strip", z.ZodTypeAny, {
    srsCompletions?: {
        cardId: number;
        correct: boolean;
        responseTime?: number | undefined;
        studyTime?: number | undefined;
        difficulty?: string | undefined;
    }[] | undefined;
    progressUpdates?: {
        vocabId: number;
        totalStudyTime: number;
        studyCount: number;
        difficulty: string;
        isLearned: boolean;
        lastStudiedAt: Date;
    }[] | undefined;
    newFolders?: {
        name: string;
        vocabIds: number[];
        settings?: Record<string, any> | undefined;
    }[] | undefined;
}, {
    srsCompletions?: {
        cardId: number;
        correct: boolean;
        responseTime?: number | undefined;
        studyTime?: number | undefined;
        difficulty?: string | undefined;
    }[] | undefined;
    progressUpdates?: {
        vocabId: number;
        totalStudyTime: number;
        studyCount: number;
        difficulty: string;
        isLearned: boolean;
        lastStudiedAt: Date;
    }[] | undefined;
    newFolders?: {
        name: string;
        vocabIds: number[];
        settings?: Record<string, any> | undefined;
    }[] | undefined;
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
    initialInterval: number;
    easyFactor: number;
    hardFactor: number;
    maxInterval: number;
    minInterval: number;
    graduationInterval: number;
    masteryThreshold: number;
}, {
    initialInterval: number;
    easyFactor: number;
    hardFactor: number;
    maxInterval: number;
    minInterval: number;
    graduationInterval: number;
    masteryThreshold: number;
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
        email: string;
        password: string;
        role?: "USER" | "ADMIN" | undefined;
        preferences?: z.objectInputType<{
            dailyGoal: z.ZodOptional<z.ZodNumber>;
            reminderTime: z.ZodOptional<z.ZodString>;
            notifications: z.ZodOptional<z.ZodBoolean>;
            offlineSync: z.ZodOptional<z.ZodBoolean>;
            audioAutoDownload: z.ZodOptional<z.ZodBoolean>;
            theme: z.ZodOptional<z.ZodEnum<["light", "dark", "system"]>>;
            language: z.ZodOptional<z.ZodString>;
        }, z.ZodTypeAny, "passthrough"> | undefined;
    };
} | {
    success: false;
    errors: any[];
};
export declare const validateUserUpdate: (data: unknown) => {
    success: true;
    data: {
        email?: string | undefined;
        role?: "USER" | "ADMIN" | undefined;
        preferences?: z.objectInputType<{
            dailyGoal: z.ZodOptional<z.ZodNumber>;
            reminderTime: z.ZodOptional<z.ZodString>;
            notifications: z.ZodOptional<z.ZodBoolean>;
            offlineSync: z.ZodOptional<z.ZodBoolean>;
            audioAutoDownload: z.ZodOptional<z.ZodBoolean>;
            theme: z.ZodOptional<z.ZodEnum<["light", "dark", "system"]>>;
            language: z.ZodOptional<z.ZodString>;
        }, z.ZodTypeAny, "passthrough"> | undefined;
        totalWords?: number | undefined;
        studyStreak?: number | undefined;
        lastStudyDate?: Date | undefined;
        level?: string | undefined;
        subscriptionType?: string | undefined;
        subscriptionExpiresAt?: Date | undefined;
    };
} | {
    success: false;
    errors: any[];
};
export declare const validateLogin: (data: unknown) => {
    success: true;
    data: {
        email: string;
        password: string;
    };
} | {
    success: false;
    errors: any[];
};
export declare const validateVocab: (data: unknown) => {
    success: true;
    data: {
        lemma: string;
        pos: "noun" | "verb" | "adjective" | "adverb" | "pronoun" | "preposition" | "conjunction" | "interjection" | "article" | "other";
        levelCEFR: "A1" | "A2" | "B1" | "B2" | "C1" | "C2";
        frequency?: number | undefined;
        source?: string | undefined;
    };
} | {
    success: false;
    errors: any[];
};
export declare const validateVocabUpdate: (data: unknown) => {
    success: true;
    data: {
        lemma?: string | undefined;
        pos?: "noun" | "verb" | "adjective" | "adverb" | "pronoun" | "preposition" | "conjunction" | "interjection" | "article" | "other" | undefined;
        levelCEFR?: "A1" | "A2" | "B1" | "B2" | "C1" | "C2" | undefined;
        frequency?: number | undefined;
        source?: string | undefined;
    };
} | {
    success: false;
    errors: any[];
};
export declare const validateSrsCard: (data: unknown) => {
    success: true;
    data: {
        userId: number;
        vocabId: number;
        level?: number | undefined;
        status?: string | undefined;
        nextDue?: Date | undefined;
    };
} | {
    success: false;
    errors: any[];
};
export declare const validateSrsCardUpdate: (data: unknown) => {
    success: true;
    data: {
        level?: number | undefined;
        status?: string | undefined;
        nextDue?: Date | undefined;
        lastStudied?: Date | undefined;
        correctCount?: number | undefined;
        incorrectCount?: number | undefined;
        totalResponseTime?: number | undefined;
        totalStudyTime?: number | undefined;
        studyCount?: number | undefined;
    };
} | {
    success: false;
    errors: any[];
};
export declare const validateSrsReview: (data: unknown) => {
    success: true;
    data: {
        cardId: number;
        correct: boolean;
        responseTime?: number | undefined;
        studyTime?: number | undefined;
        difficulty?: string | undefined;
    };
} | {
    success: false;
    errors: any[];
};
export declare const validateBatchSrsReview: (data: unknown) => {
    success: true;
    data: {
        completions: {
            cardId: number;
            correct: boolean;
            responseTime?: number | undefined;
            studyTime?: number | undefined;
            difficulty?: string | undefined;
        }[];
    };
} | {
    success: false;
    errors: any[];
};
export declare const validateProgress: (data: unknown) => {
    success: true;
    data: {
        userId: number;
        vocabId: number;
        totalStudyTime?: number | undefined;
        studyCount?: number | undefined;
        difficulty?: string | undefined;
        isLearned?: boolean | undefined;
    };
} | {
    success: false;
    errors: any[];
};
export declare const validateProgressUpdate: (data: unknown) => {
    success: true;
    data: {
        totalStudyTime?: number | undefined;
        studyCount?: number | undefined;
        difficulty?: string | undefined;
        isLearned?: boolean | undefined;
        lastStudiedAt?: Date | undefined;
    };
} | {
    success: false;
    errors: any[];
};
export declare const validateBatchProgressUpdate: (data: unknown) => {
    success: true;
    data: {
        updates: {
            vocabId: number;
            studyTime?: number | undefined;
            difficulty?: string | undefined;
            isLearned?: boolean | undefined;
        }[];
    };
} | {
    success: false;
    errors: any[];
};
export declare const validateCategory: (data: unknown) => {
    success: true;
    data: {
        name: string;
        color?: string | undefined;
        description?: string | undefined;
    };
} | {
    success: false;
    errors: any[];
};
export declare const validateCategoryUpdate: (data: unknown) => {
    success: true;
    data: {
        name?: string | undefined;
        color?: string | undefined;
        description?: string | undefined;
    };
} | {
    success: false;
    errors: any[];
};
export declare const validateQuizSubmission: (data: unknown) => {
    success: true;
    data: {
        answers: {
            responseTime: number;
            questionId: number;
            selectedAnswer: string;
        }[];
        sessionId?: string | undefined;
    };
} | {
    success: false;
    errors: any[];
};
export declare const validatePagination: (data: unknown) => {
    success: true;
    data: {
        offset?: number | undefined;
        limit?: number | undefined;
        sortBy?: string | undefined;
        sortOrder?: "asc" | "desc" | undefined;
    };
} | {
    success: false;
    errors: any[];
};
export declare const validateSearch: (data: unknown) => {
    success: true;
    data: {
        q: string;
        pos?: ("noun" | "verb" | "adjective" | "adverb" | "pronoun" | "preposition" | "conjunction" | "interjection" | "article" | "other")[] | undefined;
        categories?: string[] | undefined;
        levels?: ("A1" | "A2" | "B1" | "B2" | "C1" | "C2")[] | undefined;
    };
} | {
    success: false;
    errors: any[];
};
export declare const validateMobileLogin: (data: unknown) => {
    success: true;
    data: {
        email: string;
        password: string;
        deviceInfo?: z.objectInputType<{
            platform: z.ZodOptional<z.ZodString>;
            appVersion: z.ZodOptional<z.ZodString>;
            deviceModel: z.ZodOptional<z.ZodString>;
            osVersion: z.ZodOptional<z.ZodString>;
            userAgent: z.ZodOptional<z.ZodString>;
            deviceId: z.ZodOptional<z.ZodString>;
            isMobile: z.ZodOptional<z.ZodBoolean>;
            isNativeApp: z.ZodOptional<z.ZodBoolean>;
        }, z.ZodTypeAny, "passthrough"> | undefined;
    };
} | {
    success: false;
    errors: any[];
};
export declare const validateSyncChanges: (data: unknown) => {
    success: true;
    data: {
        srsCompletions?: {
            cardId: number;
            correct: boolean;
            responseTime?: number | undefined;
            studyTime?: number | undefined;
            difficulty?: string | undefined;
        }[] | undefined;
        progressUpdates?: {
            vocabId: number;
            totalStudyTime: number;
            studyCount: number;
            difficulty: string;
            isLearned: boolean;
            lastStudiedAt: Date;
        }[] | undefined;
        newFolders?: {
            name: string;
            vocabIds: number[];
            settings?: Record<string, any> | undefined;
        }[] | undefined;
    };
} | {
    success: false;
    errors: any[];
};
export declare const validateSrsAlgorithmConfig: (data: unknown) => {
    success: true;
    data: {
        initialInterval: number;
        easyFactor: number;
        hardFactor: number;
        maxInterval: number;
        minInterval: number;
        graduationInterval: number;
        masteryThreshold: number;
    };
} | {
    success: false;
    errors: any[];
};
//# sourceMappingURL=index.d.ts.map