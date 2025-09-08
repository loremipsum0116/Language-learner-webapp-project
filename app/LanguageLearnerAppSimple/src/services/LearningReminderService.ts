import AsyncStorage from '@react-native-async-storage/async-storage';
import notifee, {
  TimestampTrigger,
  TriggerType,
  RepeatFrequency,
  AndroidImportance,
} from '@notifee/react-native';
import {
  NotificationType,
  NotificationPriority,
  LearningPattern,
  PersonalizedNotification,
} from '../types/notifications';

const LEARNING_PATTERN_KEY = '@learning_pattern';
const OPTIMAL_TIME_KEY = '@optimal_learning_time';
const REMINDER_SETTINGS_KEY = '@reminder_settings';

export class LearningReminderService {
  private static instance: LearningReminderService;
  private learningPattern: LearningPattern | null = null;

  private constructor() {}

  static getInstance(): LearningReminderService {
    if (!LearningReminderService.instance) {
      LearningReminderService.instance = new LearningReminderService();
    }
    return LearningReminderService.instance;
  }

  async initialize(): Promise<void> {
    await this.loadLearningPattern();
    await this.createNotificationChannel();
  }

  private async createNotificationChannel(): Promise<void> {
    await notifee.createChannel({
      id: 'learning-reminders',
      name: 'Learning Reminders',
      importance: AndroidImportance.HIGH,
      sound: 'default',
      vibration: true,
    });
  }

  async updateLearningPattern(sessionData: {
    startTime: Date;
    endTime: Date;
    completedLessons: number;
  }): Promise<void> {
    const pattern = await this.loadLearningPattern();
    
    const hour = sessionData.startTime.getHours();
    const dayOfWeek = sessionData.startTime.getDay();
    const duration = Math.round(
      (sessionData.endTime.getTime() - sessionData.startTime.getTime()) / 60000
    );

    if (!pattern.optimalHours.includes(hour)) {
      pattern.optimalHours.push(hour);
    }

    if (!pattern.preferredDays.includes(dayOfWeek)) {
      pattern.preferredDays.push(dayOfWeek);
    }

    pattern.averageSessionDuration = Math.round(
      (pattern.averageSessionDuration + duration) / 2
    );
    pattern.totalLearningMinutes += duration;
    pattern.lastLearningDate = new Date();

    await this.saveLearningPattern(pattern);
    await this.updateOptimalLearningTime();
  }

  private async loadLearningPattern(): Promise<LearningPattern> {
    try {
      const stored = await AsyncStorage.getItem(LEARNING_PATTERN_KEY);
      if (stored) {
        const pattern = JSON.parse(stored);
        pattern.lastLearningDate = new Date(pattern.lastLearningDate);
        this.learningPattern = pattern;
        return pattern;
      }
    } catch (error) {
      console.error('Error loading learning pattern:', error);
    }

    const defaultPattern: LearningPattern = {
      userId: 'current-user',
      optimalHours: [],
      averageSessionDuration: 30,
      preferredDays: [],
      streakCount: 0,
      lastLearningDate: new Date(),
      totalLearningMinutes: 0,
    };

    this.learningPattern = defaultPattern;
    return defaultPattern;
  }

  private async saveLearningPattern(pattern: LearningPattern): Promise<void> {
    this.learningPattern = pattern;
    await AsyncStorage.setItem(LEARNING_PATTERN_KEY, JSON.stringify(pattern));
  }

  private async updateOptimalLearningTime(): Promise<void> {
    if (!this.learningPattern || this.learningPattern.optimalHours.length === 0) {
      return;
    }

    const hourCounts = this.learningPattern.optimalHours.reduce((acc, hour) => {
      acc[hour] = (acc[hour] || 0) + 1;
      return acc;
    }, {} as Record<number, number>);

    const optimalHour = Object.entries(hourCounts).reduce((a, b) =>
      hourCounts[a[0] as any] > hourCounts[b[0] as any] ? a : b
    )[0];

    await AsyncStorage.setItem(OPTIMAL_TIME_KEY, optimalHour);
    await this.scheduleOptimalTimeReminder(parseInt(optimalHour));
  }

  async scheduleOptimalTimeReminder(hour: number): Promise<void> {
    const now = new Date();
    const scheduledTime = new Date();
    scheduledTime.setHours(hour, 0, 0, 0);

    if (scheduledTime <= now) {
      scheduledTime.setDate(scheduledTime.getDate() + 1);
    }

    const trigger: TimestampTrigger = {
      type: TriggerType.TIMESTAMP,
      timestamp: scheduledTime.getTime(),
      repeatFrequency: RepeatFrequency.DAILY,
    };

    await notifee.createTriggerNotification(
      {
        id: 'optimal-learning-time',
        title: '🎯 Perfect Time to Learn!',
        body: 'Studies show this is your most productive learning time. Ready for a quick session?',
        android: {
          channelId: 'learning-reminders',
          importance: AndroidImportance.HIGH,
          pressAction: {
            id: 'default',
            launchActivity: 'default',
          },
        },
        ios: {
          sound: 'default',
          categoryId: 'learning-reminder',
        },
      },
      trigger
    );
  }

  async scheduleStreakReminder(): Promise<void> {
    const pattern = await this.loadLearningPattern();
    const lastLearning = new Date(pattern.lastLearningDate);
    const hoursSinceLastLearning = 
      (new Date().getTime() - lastLearning.getTime()) / (1000 * 60 * 60);

    if (hoursSinceLastLearning > 20 && hoursSinceLastLearning < 24) {
      await notifee.displayNotification({
        id: 'streak-reminder',
        title: `🔥 Keep Your ${pattern.streakCount} Day Streak!`,
        body: "Don't lose your progress! Complete a quick lesson to maintain your streak.",
        android: {
          channelId: 'learning-reminders',
          importance: AndroidImportance.HIGH,
          color: '#FF6B6B',
        },
        ios: {
          sound: 'default',
        },
      });
    }
  }

  async scheduleEncouragementMessage(): Promise<void> {
    const encouragementMessages = [
      {
        title: '💪 You\'re Doing Great!',
        body: 'Every minute of practice brings you closer to fluency.',
      },
      {
        title: '🌟 Keep Going!',
        body: 'Consistency is key to language learning success.',
      },
      {
        title: '📈 Progress Alert!',
        body: 'You\'ve been learning consistently. Time for another session?',
      },
      {
        title: '🎓 Language Champion!',
        body: 'Your dedication is impressive. Ready for today\'s challenge?',
      },
      {
        title: '🚀 Level Up Time!',
        body: 'You\'re making amazing progress. Let\'s continue the journey!',
      },
    ];

    const randomMessage = 
      encouragementMessages[Math.floor(Math.random() * encouragementMessages.length)];

    const scheduledTime = new Date();
    scheduledTime.setHours(scheduledTime.getHours() + 3);

    const trigger: TimestampTrigger = {
      type: TriggerType.TIMESTAMP,
      timestamp: scheduledTime.getTime(),
    };

    await notifee.createTriggerNotification(
      {
        id: `encouragement-${Date.now()}`,
        title: randomMessage.title,
        body: randomMessage.body,
        android: {
          channelId: 'learning-reminders',
          importance: AndroidImportance.DEFAULT,
        },
        ios: {
          sound: 'default',
        },
      },
      trigger
    );
  }

  async updateStreak(completed: boolean): Promise<void> {
    const pattern = await this.loadLearningPattern();
    const lastLearning = new Date(pattern.lastLearningDate);
    const today = new Date();
    
    const daysSinceLastLearning = Math.floor(
      (today.getTime() - lastLearning.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (completed) {
      if (daysSinceLastLearning === 1) {
        pattern.streakCount++;
      } else if (daysSinceLastLearning > 1) {
        pattern.streakCount = 1;
      }
      pattern.lastLearningDate = today;
    } else if (daysSinceLastLearning > 1) {
      pattern.streakCount = 0;
    }

    await this.saveLearningPattern(pattern);

    if (pattern.streakCount > 0 && pattern.streakCount % 7 === 0) {
      await this.sendStreakMilestoneNotification(pattern.streakCount);
    }
  }

  private async sendStreakMilestoneNotification(days: number): Promise<void> {
    await notifee.displayNotification({
      id: `streak-milestone-${days}`,
      title: `🏆 ${days} Day Streak!`,
      body: `Amazing dedication! You've been learning for ${days} days straight!`,
      android: {
        channelId: 'learning-reminders',
        importance: AndroidImportance.HIGH,
        color: '#FFD700',
      },
      ios: {
        sound: 'default',
      },
    });
  }

  async getPersonalizedReminderTime(): Promise<string> {
    const pattern = await this.loadLearningPattern();
    
    if (pattern.optimalHours.length > 0) {
      const mostFrequentHour = pattern.optimalHours.reduce((acc, hour) => {
        acc[hour] = (acc[hour] || 0) + 1;
        return acc;
      }, {} as Record<number, number>);

      const optimalHour = Object.entries(mostFrequentHour).reduce((a, b) =>
        mostFrequentHour[a[0] as any] > mostFrequentHour[b[0] as any] ? a : b
      )[0];

      return `${optimalHour}:00`;
    }

    return '19:00'; // Default evening time
  }

  async cancelAllReminders(): Promise<void> {
    await notifee.cancelAllNotifications();
  }

  async cancelReminder(id: string): Promise<void> {
    await notifee.cancelNotification(id);
  }

  async getReminderSettings(): Promise<any> {
    try {
      const settings = await AsyncStorage.getItem(REMINDER_SETTINGS_KEY);
      return settings ? JSON.parse(settings) : {};
    } catch (error) {
      console.error('Error loading reminder settings:', error);
      return {};
    }
  }

  async updateReminderSettings(settings: any): Promise<void> {
    await AsyncStorage.setItem(REMINDER_SETTINGS_KEY, JSON.stringify(settings));
  }

  getStreakCount(): number {
    return this.learningPattern?.streakCount || 0;
  }

  getTotalLearningMinutes(): number {
    return this.learningPattern?.totalLearningMinutes || 0;
  }

  getAverageSessionDuration(): number {
    return this.learningPattern?.averageSessionDuration || 30;
  }
}

export default LearningReminderService.getInstance();