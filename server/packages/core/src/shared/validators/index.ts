import { z } from 'zod';
import { 
  UserRole, 
  CEFRLevel, 
  PartOfSpeech,
  ExampleKind 
} from '@shared/types';

// Base validation schemas
export const emailSchema = z.string().email('Invalid email format');
export const passwordSchema = z.string()
  .min(8, 'Password must be at least 8 characters')
  .max(128, 'Password too long')
  .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, 'Password must contain lowercase, uppercase and number');

export const userRoleSchema = z.enum(['USER', 'ADMIN'] as const);
export const cefrLevelSchema = z.enum(['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const);
export const partOfSpeechSchema = z.enum([
  'noun', 'verb', 'adjective', 'adverb', 
  'pronoun', 'preposition', 'conjunction', 
  'interjection', 'article', 'other'
] as const);
export const exampleKindSchema = z.enum(['gloss', 'example', 'usage'] as const);

// User validation schemas
export const userPreferencesSchema = z.object({
  dailyGoal: z.number().min(1).max(200).optional(),
  reminderTime: z.string().optional(),
  notifications: z.boolean().optional(),
  offlineSync: z.boolean().optional(),
  audioAutoDownload: z.boolean().optional(),
  theme: z.enum(['light', 'dark', 'system']).optional(),
  language: z.string().optional()
}).passthrough();

export const createUserSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  role: userRoleSchema.default('USER'),
  preferences: userPreferencesSchema.optional()
});

export const updateUserSchema = z.object({
  email: emailSchema.optional(),
  role: userRoleSchema.optional(),
  preferences: userPreferencesSchema.optional(),
  totalWords: z.number().min(0).optional(),
  studyStreak: z.number().min(0).optional(),
  lastStudyDate: z.date().optional(),
  level: z.string().optional(),
  subscriptionType: z.string().optional(),
  subscriptionExpiresAt: z.date().optional()
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Password is required')
});

// Vocabulary validation schemas
export const createVocabSchema = z.object({
  lemma: z.string()
    .min(1, 'Word is required')
    .max(100, 'Word too long')
    .regex(/^[a-zA-Z\s\-'\.]+$/, 'Invalid characters in word'),
  pos: partOfSpeechSchema,
  levelCEFR: cefrLevelSchema,
  frequency: z.number().min(0).max(100000).optional(),
  source: z.string().max(50).optional()
});

export const updateVocabSchema = createVocabSchema.partial();

export const dictEntrySchema = z.object({
  definition: z.string().max(2000).optional(),
  pronunciation: z.string().max(200).optional(),
  audioLocal: z.string().max(1000).optional()
});

export const exampleSchema = z.object({
  kind: exampleKindSchema,
  en: z.string().min(1).max(1000),
  ko: z.string().max(1000).optional(),
  chirpScript: z.string().max(2000).optional()
});

// SRS validation schemas
export const createSrsCardSchema = z.object({
  userId: z.number().positive(),
  vocabId: z.number().positive(),
  level: z.number().min(1).max(10).default(1),
  status: z.string().default('AVAILABLE'),
  nextDue: z.date().default(() => new Date())
});

export const updateSrsCardSchema = z.object({
  level: z.number().min(1).max(10).optional(),
  status: z.string().optional(),
  nextDue: z.date().optional(),
  lastStudied: z.date().optional(),
  correctCount: z.number().min(0).optional(),
  incorrectCount: z.number().min(0).optional(),
  totalResponseTime: z.number().min(0).optional(),
  totalStudyTime: z.number().min(0).optional(),
  studyCount: z.number().min(0).optional()
});

export const srsReviewResultSchema = z.object({
  cardId: z.number().positive(),
  correct: z.boolean(),
  responseTime: z.number().min(0).optional(),
  studyTime: z.number().min(0).optional(),
  difficulty: z.string().optional()
});

export const batchSrsReviewSchema = z.object({
  completions: z.array(srsReviewResultSchema)
    .min(1, 'At least one completion required')
    .max(50, 'Maximum 50 completions per batch')
});

// Progress validation schemas
export const createProgressSchema = z.object({
  userId: z.number().positive(),
  vocabId: z.number().positive(),
  isLearned: z.boolean().default(false),
  difficulty: z.string().default('medium'),
  studyCount: z.number().min(0).default(0),
  totalStudyTime: z.number().min(0).default(0)
});

export const updateProgressSchema = z.object({
  isLearned: z.boolean().optional(),
  difficulty: z.string().optional(),
  lastStudiedAt: z.date().optional(),
  studyCount: z.number().min(0).optional(),
  totalStudyTime: z.number().min(0).optional()
});

export const batchProgressUpdateSchema = z.object({
  updates: z.array(z.object({
    vocabId: z.number().positive(),
    isLearned: z.boolean().optional(),
    difficulty: z.string().optional(),
    studyTime: z.number().min(0).optional()
  }))
  .min(1, 'At least one update required')
  .max(100, 'Maximum 100 updates per batch')
});

// Category validation schemas
export const createCategorySchema = z.object({
  name: z.string()
    .min(1, 'Category name is required')
    .max(50, 'Category name too long'),
  color: z.string()
    .regex(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, 'Invalid color format')
    .optional(),
  description: z.string().max(200).optional()
});

export const updateCategorySchema = createCategorySchema.partial();

// Quiz validation schemas
export const quizAnswerSchema = z.object({
  questionId: z.number().positive(),
  selectedAnswer: z.string().min(1),
  responseTime: z.number().min(0)
});

export const quizSubmissionSchema = z.object({
  answers: z.array(quizAnswerSchema).min(1),
  sessionId: z.string().optional()
});

// API validation schemas
export const paginationSchema = z.object({
  offset: z.number().min(0).default(0),
  limit: z.number().min(1).max(100).default(20),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).default('asc')
});

export const searchSchema = z.object({
  q: z.string().min(1, 'Search query is required').max(100),
  categories: z.array(z.string()).optional(),
  levels: z.array(cefrLevelSchema).optional(),
  pos: z.array(partOfSpeechSchema).optional()
});

// Mobile API validation schemas
export const deviceInfoSchema = z.object({
  platform: z.string().optional(),
  appVersion: z.string().optional(),
  deviceModel: z.string().optional(),
  osVersion: z.string().optional(),
  userAgent: z.string().optional(),
  deviceId: z.string().optional(),
  isMobile: z.boolean().optional(),
  isNativeApp: z.boolean().optional()
}).passthrough();

export const mobileLoginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1),
  deviceInfo: deviceInfoSchema.optional()
});

// Sync validation schemas
export const syncChangesSchema = z.object({
  srsCompletions: z.array(srsReviewResultSchema).optional(),
  progressUpdates: z.array(z.object({
    vocabId: z.number().positive(),
    isLearned: z.boolean(),
    difficulty: z.string(),
    lastStudiedAt: z.date(),
    studyCount: z.number().min(0),
    totalStudyTime: z.number().min(0)
  })).optional(),
  newFolders: z.array(z.object({
    name: z.string().min(1).max(100),
    vocabIds: z.array(z.number().positive()),
    settings: z.record(z.any()).optional()
  })).optional()
});

// Configuration validation schemas
export const srsAlgorithmConfigSchema = z.object({
  initialInterval: z.number().min(1),
  easyFactor: z.number().min(1.1).max(5),
  hardFactor: z.number().min(0.5).max(1.5),
  maxInterval: z.number().min(1440), // At least 1 day
  minInterval: z.number().min(1),
  graduationInterval: z.number().min(60),
  masteryThreshold: z.number().min(1).max(10)
});

// Custom validation functions
export const validateId = (id: any): id is number => {
  return typeof id === 'number' && id > 0 && Number.isInteger(id);
};

export const validateEmail = (email: string): boolean => {
  return emailSchema.safeParse(email).success;
};

export const validatePassword = (password: string): { valid: boolean; errors: string[] } => {
  const result = passwordSchema.safeParse(password);
  return {
    valid: result.success,
    errors: result.success ? [] : result.error.issues.map((issue: any) => issue.message)
  };
};

export const validateCEFRLevel = (level: string): level is CEFRLevel => {
  return cefrLevelSchema.safeParse(level).success;
};

export const validatePartOfSpeech = (pos: string): pos is PartOfSpeech => {
  return partOfSpeechSchema.safeParse(pos).success;
};

// Sanitization functions
export const sanitizeString = (str: string, maxLength: number = 1000): string => {
  return str.trim().slice(0, maxLength);
};

export const sanitizeHtml = (html: string): string => {
  // Basic HTML sanitization - remove script tags and dangerous attributes
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+="[^"]*"/gi, '')
    .replace(/on\w+='[^']*'/gi, '');
};

// Validation error formatting
export const formatValidationError = (error: z.ZodError): {
  field: string;
  message: string;
  code: string;
}[] => {
  return error.issues.map((issue: any) => ({
    field: issue.path.join('.'),
    message: issue.message,
    code: issue.code
  }));
};

// Validation middleware helper
export const createValidator = <T>(schema: z.ZodSchema<T>) => {
  return (data: unknown): { success: true; data: T } | { success: false; errors: any[] } => {
    const result = schema.safeParse(data);
    if (result.success) {
      return { success: true, data: result.data };
    }
    return { success: false, errors: formatValidationError(result.error) };
  };
};

// Export individual validators
export const validateUser = createValidator(createUserSchema);
export const validateUserUpdate = createValidator(updateUserSchema);
export const validateLogin = createValidator(loginSchema);
export const validateVocab = createValidator(createVocabSchema);
export const validateVocabUpdate = createValidator(updateVocabSchema);
export const validateSrsCard = createValidator(createSrsCardSchema);
export const validateSrsCardUpdate = createValidator(updateSrsCardSchema);
export const validateSrsReview = createValidator(srsReviewResultSchema);
export const validateBatchSrsReview = createValidator(batchSrsReviewSchema);
export const validateProgress = createValidator(createProgressSchema);
export const validateProgressUpdate = createValidator(updateProgressSchema);
export const validateBatchProgressUpdate = createValidator(batchProgressUpdateSchema);
export const validateCategory = createValidator(createCategorySchema);
export const validateCategoryUpdate = createValidator(updateCategorySchema);
export const validateQuizSubmission = createValidator(quizSubmissionSchema);
export const validatePagination = createValidator(paginationSchema);
export const validateSearch = createValidator(searchSchema);
export const validateMobileLogin = createValidator(mobileLoginSchema);
export const validateSyncChanges = createValidator(syncChangesSchema);
export const validateSrsAlgorithmConfig = createValidator(srsAlgorithmConfigSchema);