import {useState, useEffect, useCallback} from 'react';
import NotificationScheduler from '../services/NotificationScheduler';
import LearningReminderService from '../services/LearningReminderService';
import SRSNotificationService from '../services/SRSNotificationService';
import ProgressNotificationService from '../services/ProgressNotificationService';
import {
  NotificationPreferences,
  LearningGoal,
  SRSReviewItem,
  NotificationType,
} from '../types/notifications';

export interface UsePersonalizedNotificationsReturn {
  preferences: NotificationPreferences | null;
  isInitialized: boolean;
  streakCount: number;
  totalLearningMinutes: number;
  dueReviews: SRSReviewItem[];
  updatePreferences: (prefs: Partial<NotificationPreferences>) => Promise<void>;
  updateLearningSession: (data: {
    startTime: Date;
    endTime: Date;
    completedLessons: number;
    wordsLearned?: number;
  }) => Promise<void>;
  updateStreak: (completed: boolean) => Promise<void>;
  createGoal: (goal: Omit<LearningGoal, 'id' | 'completed'>) => Promise<void>;
  addSRSReview: (item: Omit<SRSReviewItem, 'id'>) => Promise<void>;
  processSRSReview: (itemId: string, quality: number) => Promise<void>;
  getDueReviews: () => Promise<SRSReviewItem[]>;
  getOptimalLearningTime: () => Promise<string>;
  sendTestNotification: (type: NotificationType) => Promise<void>;
  refreshData: () => Promise<void>;
}

export const usePersonalizedNotifications = (): UsePersonalizedNotificationsReturn => {
  const [preferences, setPreferences] = useState<NotificationPreferences | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [streakCount, setStreakCount] = useState(0);
  const [totalLearningMinutes, setTotalLearningMinutes] = useState(0);
  const [dueReviews, setDueReviews] = useState<SRSReviewItem[]>([]);

  useEffect(() => {
    initializeServices();
  }, []);

  const initializeServices = async () => {
    try {
      await NotificationScheduler.initialize();
      
      const prefs = NotificationScheduler.getPreferences();
      setPreferences(prefs);
      
      await refreshData();
      
      setIsInitialized(true);
    } catch (error) {
      console.error('Failed to initialize notification services:', error);
    }
  };

  const refreshData = async () => {
    try {
      // Get streak count
      const streak = LearningReminderService.getStreakCount();
      setStreakCount(streak);

      // Get total learning time
      const totalMinutes = LearningReminderService.getTotalLearningMinutes();
      setTotalLearningMinutes(totalMinutes);

      // Get due reviews
      const reviews = await SRSNotificationService.getDueReviews();
      setDueReviews(reviews);
    } catch (error) {
      console.error('Failed to refresh notification data:', error);
    }
  };

  const updatePreferences = useCallback(
    async (prefs: Partial<NotificationPreferences>) => {
      try {
        await NotificationScheduler.updatePreferences(prefs);
        const updatedPrefs = NotificationScheduler.getPreferences();
        setPreferences(updatedPrefs);
      } catch (error) {
        console.error('Failed to update preferences:', error);
        throw error;
      }
    },
    []
  );

  const updateLearningSession = useCallback(
    async (data: {
      startTime: Date;
      endTime: Date;
      completedLessons: number;
      wordsLearned?: number;
    }) => {
      try {
        // Update learning pattern
        await LearningReminderService.updateLearningPattern({
          startTime: data.startTime,
          endTime: data.endTime,
          completedLessons: data.completedLessons,
        });

        // Update progress
        const sessionMinutes = Math.round(
          (data.endTime.getTime() - data.startTime.getTime()) / 60000
        );

        await ProgressNotificationService.updateProgress({
          lessons: data.completedLessons,
          minutes: sessionMinutes,
          words: data.wordsLearned || 0,
        });

        await refreshData();
      } catch (error) {
        console.error('Failed to update learning session:', error);
        throw error;
      }
    },
    []
  );

  const updateStreak = useCallback(async (completed: boolean) => {
    try {
      await LearningReminderService.updateStreak(completed);
      const newStreak = LearningReminderService.getStreakCount();
      setStreakCount(newStreak);

      // Update progress with streak info
      await ProgressNotificationService.updateProgress({
        streakDays: newStreak,
      });
    } catch (error) {
      console.error('Failed to update streak:', error);
      throw error;
    }
  }, []);

  const createGoal = useCallback(
    async (goal: Omit<LearningGoal, 'id' | 'completed'>) => {
      try {
        await ProgressNotificationService.createGoal(goal);
      } catch (error) {
        console.error('Failed to create goal:', error);
        throw error;
      }
    },
    []
  );

  const addSRSReview = useCallback(
    async (item: Omit<SRSReviewItem, 'id'>) => {
      try {
        await SRSNotificationService.addReviewItem(item);
        await refreshData();
      } catch (error) {
        console.error('Failed to add SRS review:', error);
        throw error;
      }
    },
    []
  );

  const processSRSReview = useCallback(
    async (itemId: string, quality: number) => {
      try {
        await SRSNotificationService.processReview(itemId, quality);
        await refreshData();
      } catch (error) {
        console.error('Failed to process SRS review:', error);
        throw error;
      }
    },
    []
  );

  const getDueReviews = useCallback(async () => {
    try {
      return await SRSNotificationService.getDueReviews();
    } catch (error) {
      console.error('Failed to get due reviews:', error);
      return [];
    }
  }, []);

  const getOptimalLearningTime = useCallback(async () => {
    try {
      return await LearningReminderService.getPersonalizedReminderTime();
    } catch (error) {
      console.error('Failed to get optimal learning time:', error);
      return '19:00';
    }
  }, []);

  const sendTestNotification = useCallback(
    async (type: NotificationType) => {
      try {
        await NotificationScheduler.triggerTestNotification(type);
      } catch (error) {
        console.error('Failed to send test notification:', error);
        throw error;
      }
    },
    []
  );

  return {
    preferences,
    isInitialized,
    streakCount,
    totalLearningMinutes,
    dueReviews,
    updatePreferences,
    updateLearningSession,
    updateStreak,
    createGoal,
    addSRSReview,
    processSRSReview,
    getDueReviews,
    getOptimalLearningTime,
    sendTestNotification,
    refreshData,
  };
};