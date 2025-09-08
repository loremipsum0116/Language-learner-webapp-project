export enum NotificationType {
  LEARNING_REMINDER = 'learning_reminder',
  STREAK_REMINDER = 'streak_reminder',
  SRS_REVIEW = 'srs_review',
  GOAL_ACHIEVED = 'goal_achieved',
  MILESTONE_REACHED = 'milestone_reached',
  NEW_CONTENT = 'new_content',
  WEEKLY_PROGRESS = 'weekly_progress',
  OPTIMAL_TIME = 'optimal_time',
  ENCOURAGEMENT = 'encouragement',
}

export enum NotificationPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  URGENT = 'urgent',
}

export interface NotificationPreferences {
  enabled: boolean;
  optimalLearningTime?: string; // HH:mm format
  dailyReminderTime?: string;
  weeklyProgressDay?: number; // 0-6 (Sunday-Saturday)
  streakReminder: boolean;
  srsReminder: boolean;
  achievementAlerts: boolean;
  newContentAlerts: boolean;
  encouragementMessages: boolean;
  soundEnabled: boolean;
  vibrationEnabled: boolean;
}

export interface PersonalizedNotification {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  priority: NotificationPriority;
  scheduledTime?: Date;
  data?: Record<string, any>;
  actionButtons?: NotificationAction[];
  imageUrl?: string;
  soundName?: string;
  badge?: number;
}

export interface NotificationAction {
  id: string;
  title: string;
  action: string;
  params?: Record<string, any>;
}

export interface LearningPattern {
  userId: string;
  optimalHours: number[]; // Hours of day (0-23) when user is most active
  averageSessionDuration: number; // in minutes
  preferredDays: number[]; // Days of week (0-6)
  streakCount: number;
  lastLearningDate: Date;
  totalLearningMinutes: number;
}

export interface SRSReviewItem {
  id: string;
  userId: string;
  contentId: string;
  contentType: 'vocabulary' | 'grammar' | 'phrase';
  nextReviewDate: Date;
  interval: number; // days
  easeFactor: number;
  repetitions: number;
  lastReviewDate?: Date;
}

export interface LearningGoal {
  id: string;
  userId: string;
  type: 'daily' | 'weekly' | 'monthly';
  targetMinutes?: number;
  targetLessons?: number;
  targetWords?: number;
  currentProgress: number;
  startDate: Date;
  endDate: Date;
  completed: boolean;
}

export interface NotificationTemplate {
  type: NotificationType;
  templates: {
    title: string[];
    body: string[];
  };
  getPersonalizedMessage?: (data: any) => {
    title: string;
    body: string;
  };
}

export interface NotificationSchedule {
  id: string;
  userId: string;
  notificationType: NotificationType;
  scheduledTime: Date;
  recurring: boolean;
  recurringPattern?: RecurringPattern;
  enabled: boolean;
  lastSentDate?: Date;
  metadata?: Record<string, any>;
}

export interface RecurringPattern {
  frequency: 'daily' | 'weekly' | 'monthly';
  interval: number; // e.g., every 2 days
  daysOfWeek?: number[]; // For weekly: 0-6
  dayOfMonth?: number; // For monthly
  time: string; // HH:mm format
}

export interface NotificationAnalytics {
  userId: string;
  notificationId: string;
  type: NotificationType;
  sentAt: Date;
  openedAt?: Date;
  actionTaken?: string;
  dismissed: boolean;
  engagementScore: number; // 0-100
}