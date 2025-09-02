"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateProgress = exports.validateBatchSrsReview = exports.validateSrsReview = exports.validateSrsCardUpdate = exports.validateSrsCard = exports.validateVocabUpdate = exports.validateVocab = exports.validateLogin = exports.validateUserUpdate = exports.validateUser = exports.createValidator = exports.formatValidationError = exports.sanitizeHtml = exports.sanitizeString = exports.validatePartOfSpeech = exports.validateCEFRLevel = exports.validatePassword = exports.validateEmail = exports.validateId = exports.srsAlgorithmConfigSchema = exports.syncChangesSchema = exports.mobileLoginSchema = exports.deviceInfoSchema = exports.searchSchema = exports.paginationSchema = exports.quizSubmissionSchema = exports.quizAnswerSchema = exports.updateCategorySchema = exports.createCategorySchema = exports.batchProgressUpdateSchema = exports.updateProgressSchema = exports.createProgressSchema = exports.batchSrsReviewSchema = exports.srsReviewResultSchema = exports.updateSrsCardSchema = exports.createSrsCardSchema = exports.exampleSchema = exports.dictEntrySchema = exports.updateVocabSchema = exports.createVocabSchema = exports.loginSchema = exports.updateUserSchema = exports.createUserSchema = exports.userPreferencesSchema = exports.exampleKindSchema = exports.partOfSpeechSchema = exports.cefrLevelSchema = exports.userRoleSchema = exports.passwordSchema = exports.emailSchema = void 0;
exports.validateSrsAlgorithmConfig = exports.validateSyncChanges = exports.validateMobileLogin = exports.validateSearch = exports.validatePagination = exports.validateQuizSubmission = exports.validateCategoryUpdate = exports.validateCategory = exports.validateBatchProgressUpdate = exports.validateProgressUpdate = void 0;
const zod_1 = require("zod");
exports.emailSchema = zod_1.z.string().email('Invalid email format');
exports.passwordSchema = zod_1.z.string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password too long')
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, 'Password must contain lowercase, uppercase and number');
exports.userRoleSchema = zod_1.z.enum(['USER', 'ADMIN']);
exports.cefrLevelSchema = zod_1.z.enum(['A1', 'A2', 'B1', 'B2', 'C1', 'C2']);
exports.partOfSpeechSchema = zod_1.z.enum([
    'noun', 'verb', 'adjective', 'adverb',
    'pronoun', 'preposition', 'conjunction',
    'interjection', 'article', 'other'
]);
exports.exampleKindSchema = zod_1.z.enum(['gloss', 'example', 'usage']);
exports.userPreferencesSchema = zod_1.z.object({
    dailyGoal: zod_1.z.number().min(1).max(200).optional(),
    reminderTime: zod_1.z.string().optional(),
    notifications: zod_1.z.boolean().optional(),
    offlineSync: zod_1.z.boolean().optional(),
    audioAutoDownload: zod_1.z.boolean().optional(),
    theme: zod_1.z.enum(['light', 'dark', 'system']).optional(),
    language: zod_1.z.string().optional()
}).passthrough();
exports.createUserSchema = zod_1.z.object({
    email: exports.emailSchema,
    password: exports.passwordSchema,
    role: exports.userRoleSchema.default('USER'),
    preferences: exports.userPreferencesSchema.optional()
});
exports.updateUserSchema = zod_1.z.object({
    email: exports.emailSchema.optional(),
    role: exports.userRoleSchema.optional(),
    preferences: exports.userPreferencesSchema.optional(),
    totalWords: zod_1.z.number().min(0).optional(),
    studyStreak: zod_1.z.number().min(0).optional(),
    lastStudyDate: zod_1.z.date().optional(),
    level: zod_1.z.string().optional(),
    subscriptionType: zod_1.z.string().optional(),
    subscriptionExpiresAt: zod_1.z.date().optional()
});
exports.loginSchema = zod_1.z.object({
    email: exports.emailSchema,
    password: zod_1.z.string().min(1, 'Password is required')
});
exports.createVocabSchema = zod_1.z.object({
    lemma: zod_1.z.string()
        .min(1, 'Word is required')
        .max(100, 'Word too long')
        .regex(/^[a-zA-Z\s\-'\.]+$/, 'Invalid characters in word'),
    pos: exports.partOfSpeechSchema,
    levelCEFR: exports.cefrLevelSchema,
    frequency: zod_1.z.number().min(0).max(100000).optional(),
    source: zod_1.z.string().max(50).optional()
});
exports.updateVocabSchema = exports.createVocabSchema.partial();
exports.dictEntrySchema = zod_1.z.object({
    definition: zod_1.z.string().max(2000).optional(),
    pronunciation: zod_1.z.string().max(200).optional(),
    audioLocal: zod_1.z.string().max(1000).optional()
});
exports.exampleSchema = zod_1.z.object({
    kind: exports.exampleKindSchema,
    en: zod_1.z.string().min(1).max(1000),
    ko: zod_1.z.string().max(1000).optional(),
    chirpScript: zod_1.z.string().max(2000).optional()
});
exports.createSrsCardSchema = zod_1.z.object({
    userId: zod_1.z.number().positive(),
    vocabId: zod_1.z.number().positive(),
    level: zod_1.z.number().min(1).max(10).default(1),
    status: zod_1.z.string().default('AVAILABLE'),
    nextDue: zod_1.z.date().default(() => new Date())
});
exports.updateSrsCardSchema = zod_1.z.object({
    level: zod_1.z.number().min(1).max(10).optional(),
    status: zod_1.z.string().optional(),
    nextDue: zod_1.z.date().optional(),
    lastStudied: zod_1.z.date().optional(),
    correctCount: zod_1.z.number().min(0).optional(),
    incorrectCount: zod_1.z.number().min(0).optional(),
    totalResponseTime: zod_1.z.number().min(0).optional(),
    totalStudyTime: zod_1.z.number().min(0).optional(),
    studyCount: zod_1.z.number().min(0).optional()
});
exports.srsReviewResultSchema = zod_1.z.object({
    cardId: zod_1.z.number().positive(),
    correct: zod_1.z.boolean(),
    responseTime: zod_1.z.number().min(0).optional(),
    studyTime: zod_1.z.number().min(0).optional(),
    difficulty: zod_1.z.string().optional()
});
exports.batchSrsReviewSchema = zod_1.z.object({
    completions: zod_1.z.array(exports.srsReviewResultSchema)
        .min(1, 'At least one completion required')
        .max(50, 'Maximum 50 completions per batch')
});
exports.createProgressSchema = zod_1.z.object({
    userId: zod_1.z.number().positive(),
    vocabId: zod_1.z.number().positive(),
    isLearned: zod_1.z.boolean().default(false),
    difficulty: zod_1.z.string().default('medium'),
    studyCount: zod_1.z.number().min(0).default(0),
    totalStudyTime: zod_1.z.number().min(0).default(0)
});
exports.updateProgressSchema = zod_1.z.object({
    isLearned: zod_1.z.boolean().optional(),
    difficulty: zod_1.z.string().optional(),
    lastStudiedAt: zod_1.z.date().optional(),
    studyCount: zod_1.z.number().min(0).optional(),
    totalStudyTime: zod_1.z.number().min(0).optional()
});
exports.batchProgressUpdateSchema = zod_1.z.object({
    updates: zod_1.z.array(zod_1.z.object({
        vocabId: zod_1.z.number().positive(),
        isLearned: zod_1.z.boolean().optional(),
        difficulty: zod_1.z.string().optional(),
        studyTime: zod_1.z.number().min(0).optional()
    }))
        .min(1, 'At least one update required')
        .max(100, 'Maximum 100 updates per batch')
});
exports.createCategorySchema = zod_1.z.object({
    name: zod_1.z.string()
        .min(1, 'Category name is required')
        .max(50, 'Category name too long'),
    color: zod_1.z.string()
        .regex(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, 'Invalid color format')
        .optional(),
    description: zod_1.z.string().max(200).optional()
});
exports.updateCategorySchema = exports.createCategorySchema.partial();
exports.quizAnswerSchema = zod_1.z.object({
    questionId: zod_1.z.number().positive(),
    selectedAnswer: zod_1.z.string().min(1),
    responseTime: zod_1.z.number().min(0)
});
exports.quizSubmissionSchema = zod_1.z.object({
    answers: zod_1.z.array(exports.quizAnswerSchema).min(1),
    sessionId: zod_1.z.string().optional()
});
exports.paginationSchema = zod_1.z.object({
    offset: zod_1.z.number().min(0).default(0),
    limit: zod_1.z.number().min(1).max(100).default(20),
    sortBy: zod_1.z.string().optional(),
    sortOrder: zod_1.z.enum(['asc', 'desc']).default('asc')
});
exports.searchSchema = zod_1.z.object({
    q: zod_1.z.string().min(1, 'Search query is required').max(100),
    categories: zod_1.z.array(zod_1.z.string()).optional(),
    levels: zod_1.z.array(exports.cefrLevelSchema).optional(),
    pos: zod_1.z.array(exports.partOfSpeechSchema).optional()
});
exports.deviceInfoSchema = zod_1.z.object({
    platform: zod_1.z.string().optional(),
    appVersion: zod_1.z.string().optional(),
    deviceModel: zod_1.z.string().optional(),
    osVersion: zod_1.z.string().optional(),
    userAgent: zod_1.z.string().optional(),
    deviceId: zod_1.z.string().optional(),
    isMobile: zod_1.z.boolean().optional(),
    isNativeApp: zod_1.z.boolean().optional()
}).passthrough();
exports.mobileLoginSchema = zod_1.z.object({
    email: exports.emailSchema,
    password: zod_1.z.string().min(1),
    deviceInfo: exports.deviceInfoSchema.optional()
});
exports.syncChangesSchema = zod_1.z.object({
    srsCompletions: zod_1.z.array(exports.srsReviewResultSchema).optional(),
    progressUpdates: zod_1.z.array(zod_1.z.object({
        vocabId: zod_1.z.number().positive(),
        isLearned: zod_1.z.boolean(),
        difficulty: zod_1.z.string(),
        lastStudiedAt: zod_1.z.date(),
        studyCount: zod_1.z.number().min(0),
        totalStudyTime: zod_1.z.number().min(0)
    })).optional(),
    newFolders: zod_1.z.array(zod_1.z.object({
        name: zod_1.z.string().min(1).max(100),
        vocabIds: zod_1.z.array(zod_1.z.number().positive()),
        settings: zod_1.z.record(zod_1.z.any()).optional()
    })).optional()
});
exports.srsAlgorithmConfigSchema = zod_1.z.object({
    initialInterval: zod_1.z.number().min(1),
    easyFactor: zod_1.z.number().min(1.1).max(5),
    hardFactor: zod_1.z.number().min(0.5).max(1.5),
    maxInterval: zod_1.z.number().min(1440),
    minInterval: zod_1.z.number().min(1),
    graduationInterval: zod_1.z.number().min(60),
    masteryThreshold: zod_1.z.number().min(1).max(10)
});
const validateId = (id) => {
    return typeof id === 'number' && id > 0 && Number.isInteger(id);
};
exports.validateId = validateId;
const validateEmail = (email) => {
    return exports.emailSchema.safeParse(email).success;
};
exports.validateEmail = validateEmail;
const validatePassword = (password) => {
    const result = exports.passwordSchema.safeParse(password);
    return {
        valid: result.success,
        errors: result.success ? [] : result.error.issues.map((issue) => issue.message)
    };
};
exports.validatePassword = validatePassword;
const validateCEFRLevel = (level) => {
    return exports.cefrLevelSchema.safeParse(level).success;
};
exports.validateCEFRLevel = validateCEFRLevel;
const validatePartOfSpeech = (pos) => {
    return exports.partOfSpeechSchema.safeParse(pos).success;
};
exports.validatePartOfSpeech = validatePartOfSpeech;
const sanitizeString = (str, maxLength = 1000) => {
    return str.trim().slice(0, maxLength);
};
exports.sanitizeString = sanitizeString;
const sanitizeHtml = (html) => {
    return html
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/javascript:/gi, '')
        .replace(/on\w+="[^"]*"/gi, '')
        .replace(/on\w+='[^']*'/gi, '');
};
exports.sanitizeHtml = sanitizeHtml;
const formatValidationError = (error) => {
    return error.issues.map((issue) => ({
        field: issue.path.join('.'),
        message: issue.message,
        code: issue.code
    }));
};
exports.formatValidationError = formatValidationError;
const createValidator = (schema) => {
    return (data) => {
        const result = schema.safeParse(data);
        if (result.success) {
            return { success: true, data: result.data };
        }
        return { success: false, errors: (0, exports.formatValidationError)(result.error) };
    };
};
exports.createValidator = createValidator;
exports.validateUser = (0, exports.createValidator)(exports.createUserSchema);
exports.validateUserUpdate = (0, exports.createValidator)(exports.updateUserSchema);
exports.validateLogin = (0, exports.createValidator)(exports.loginSchema);
exports.validateVocab = (0, exports.createValidator)(exports.createVocabSchema);
exports.validateVocabUpdate = (0, exports.createValidator)(exports.updateVocabSchema);
exports.validateSrsCard = (0, exports.createValidator)(exports.createSrsCardSchema);
exports.validateSrsCardUpdate = (0, exports.createValidator)(exports.updateSrsCardSchema);
exports.validateSrsReview = (0, exports.createValidator)(exports.srsReviewResultSchema);
exports.validateBatchSrsReview = (0, exports.createValidator)(exports.batchSrsReviewSchema);
exports.validateProgress = (0, exports.createValidator)(exports.createProgressSchema);
exports.validateProgressUpdate = (0, exports.createValidator)(exports.updateProgressSchema);
exports.validateBatchProgressUpdate = (0, exports.createValidator)(exports.batchProgressUpdateSchema);
exports.validateCategory = (0, exports.createValidator)(exports.createCategorySchema);
exports.validateCategoryUpdate = (0, exports.createValidator)(exports.updateCategorySchema);
exports.validateQuizSubmission = (0, exports.createValidator)(exports.quizSubmissionSchema);
exports.validatePagination = (0, exports.createValidator)(exports.paginationSchema);
exports.validateSearch = (0, exports.createValidator)(exports.searchSchema);
exports.validateMobileLogin = (0, exports.createValidator)(exports.mobileLoginSchema);
exports.validateSyncChanges = (0, exports.createValidator)(exports.syncChangesSchema);
exports.validateSrsAlgorithmConfig = (0, exports.createValidator)(exports.srsAlgorithmConfigSchema);
