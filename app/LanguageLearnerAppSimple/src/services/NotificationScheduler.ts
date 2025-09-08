import notifee, {
  TimestampTrigger,
  TriggerType,
  IntervalTrigger,
  TimeUnit,
} from '@notifee/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import LearningReminderService from './LearningReminderService';
import SRSNotificationService from './SRSNotificationService';
import ProgressNotificationService from './ProgressNotificationService';
import {
  NotificationSchedule,
  NotificationType,
  RecurringPattern,
  NotificationPreferences,
} from '../types/notifications';

const SCHEDULES_KEY = '@notification_schedules';
const PREFERENCES_KEY = '@notification_preferences';

export class NotificationScheduler {
  private static instance: NotificationScheduler;
  private schedules: Map<string, NotificationSchedule> = new Map();
  private preferences: NotificationPreferences = {
    enabled: true,
    streakReminder: true,
    srsReminder: true,
    achievementAlerts: true,
    newContentAlerts: true,
    encouragementMessages: true,
    soundEnabled: true,
    vibrationEnabled: true,
  };

  private constructor() {}

  static getInstance(): NotificationScheduler {
    if (!NotificationScheduler.instance) {
      NotificationScheduler.instance = new NotificationScheduler();
    }
    return NotificationScheduler.instance;
  }

  async initialize(): Promise<void> {
    await this.loadSchedules();
    await this.loadPreferences();
    await this.initializeServices();
    await this.setupDefaultSchedules();
    await this.rescheduleAll();
  }

  private async initializeServices(): Promise<void> {
    await LearningReminderService.initialize();
    await SRSNotificationService.initialize();
    await ProgressNotificationService.initialize();
  }

  private async setupDefaultSchedules(): Promise<void> {
    const defaultSchedules: NotificationSchedule[] = [
      {
        id: 'daily-reminder',
        userId: 'current-user',
        notificationType: NotificationType.LEARNING_REMINDER,
        scheduledTime: this.getDefaultTime(19, 0), // 7 PM
        recurring: true,
        recurringPattern: {
          frequency: 'daily',
          interval: 1,
          time: '19:00',
        },
        enabled: true,
      },
      {
        id: 'streak-check',
        userId: 'current-user',
        notificationType: NotificationType.STREAK_REMINDER,
        scheduledTime: this.getDefaultTime(21, 0), // 9 PM
        recurring: true,
        recurringPattern: {
          frequency: 'daily',
          interval: 1,
          time: '21:00',
        },
        enabled: true,
      },
      {
        id: 'weekly-progress',
        userId: 'current-user',
        notificationType: NotificationType.WEEKLY_PROGRESS,
        scheduledTime: this.getNextSunday(18, 0), // Sunday 6 PM
        recurring: true,
        recurringPattern: {
          frequency: 'weekly',
          interval: 1,
          daysOfWeek: [0], // Sunday
          time: '18:00',
        },
        enabled: true,
      },
    ];

    for (const schedule of defaultSchedules) {
      if (!this.schedules.has(schedule.id)) {
        this.schedules.set(schedule.id, schedule);
      }
    }

    await this.saveSchedules();
  }

  async scheduleNotification(schedule: NotificationSchedule): Promise<void> {
    if (!schedule.enabled || !this.preferences.enabled) return;

    const trigger = this.createTrigger(schedule);
    if (!trigger) return;

    const notification = await this.createNotificationContent(schedule);

    await notifee.createTriggerNotification(notification, trigger);
    
    this.schedules.set(schedule.id, schedule);
    await this.saveSchedules();
  }

  private createTrigger(
    schedule: NotificationSchedule
  ): TimestampTrigger | IntervalTrigger | null {
    if (!schedule.recurring) {
      return {
        type: TriggerType.TIMESTAMP,
        timestamp: schedule.scheduledTime.getTime(),
      };
    }

    if (!schedule.recurringPattern) return null;

    const pattern = schedule.recurringPattern;

    switch (pattern.frequency) {
      case 'daily':
        return {
          type: TriggerType.INTERVAL,
          interval: pattern.interval,
          timeUnit: TimeUnit.DAYS,
        };
      
      case 'weekly':
        // For weekly, we need to schedule individual notifications for each day
        if (pattern.daysOfWeek && pattern.daysOfWeek.length > 0) {
          const nextOccurrence = this.getNextWeeklyOccurrence(
            pattern.daysOfWeek[0],
            pattern.time
          );
          return {
            type: TriggerType.TIMESTAMP,
            timestamp: nextOccurrence.getTime(),
            repeatFrequency: RepeatFrequency.WEEKLY,
          };
        }
        break;
      
      case 'monthly':
        if (pattern.dayOfMonth) {
          const nextOccurrence = this.getNextMonthlyOccurrence(
            pattern.dayOfMonth,
            pattern.time
          );
          return {
            type: TriggerType.TIMESTAMP,
            timestamp: nextOccurrence.getTime(),
          };
        }
        break;
    }

    return null;
  }

  private async createNotificationContent(
    schedule: NotificationSchedule
  ): Promise<any> {
    const baseNotification = {
      id: schedule.id,
      android: {
        channelId: this.getChannelForType(schedule.notificationType),
        sound: this.preferences.soundEnabled ? 'default' : undefined,
        vibration: this.preferences.vibrationEnabled,
      },
      ios: {
        sound: this.preferences.soundEnabled ? 'default' : undefined,
      },
    };

    switch (schedule.notificationType) {
      case NotificationType.LEARNING_REMINDER:
        return {
          ...baseNotification,
          title: '📚 Time to Learn!',
          body: 'Continue your language learning journey with a quick lesson.',
        };

      case NotificationType.STREAK_REMINDER:
        const streakCount = LearningReminderService.getStreakCount();
        return {
          ...baseNotification,
          title: `🔥 ${streakCount} Day Streak`,
          body: "Don't break your streak! Complete today's lesson.",
        };

      case NotificationType.SRS_REVIEW:
        const stats = SRSNotificationService.getStatistics();
        return {
          ...baseNotification,
          title: '🎯 Reviews Available',
          body: `You have ${stats.dueToday} items ready for review.`,
        };

      case NotificationType.WEEKLY_PROGRESS:
        return {
          ...baseNotification,
          title: '📊 Weekly Summary',
          body: 'Check out your learning progress this week!',
        };

      case NotificationType.OPTIMAL_TIME:
        return {
          ...baseNotification,
          title: '⭐ Optimal Learning Time',
          body: 'This is your most productive time to learn!',
        };

      default:
        return {
          ...baseNotification,
          title: 'Language Learner',
          body: 'You have a new notification',
        };
    }
  }

  private getChannelForType(type: NotificationType): string {
    switch (type) {
      case NotificationType.LEARNING_REMINDER:
      case NotificationType.STREAK_REMINDER:
      case NotificationType.OPTIMAL_TIME:
      case NotificationType.ENCOURAGEMENT:
        return 'learning-reminders';
      
      case NotificationType.SRS_REVIEW:
        return 'srs-reviews';
      
      case NotificationType.GOAL_ACHIEVED:
      case NotificationType.MILESTONE_REACHED:
      case NotificationType.NEW_CONTENT:
      case NotificationType.WEEKLY_PROGRESS:
        return 'progress-updates';
      
      default:
        return 'default';
    }
  }

  async updatePreferences(
    preferences: Partial<NotificationPreferences>
  ): Promise<void> {
    this.preferences = {...this.preferences, ...preferences};
    await this.savePreferences();

    if (!preferences.enabled) {
      await this.cancelAllScheduled();
    } else {
      await this.rescheduleAll();
    }
  }

  async updateSchedule(
    scheduleId: string,
    updates: Partial<NotificationSchedule>
  ): Promise<void> {
    const schedule = this.schedules.get(scheduleId);
    if (!schedule) return;

    const updatedSchedule = {...schedule, ...updates};
    this.schedules.set(scheduleId, updatedSchedule);
    
    await notifee.cancelNotification(scheduleId);
    
    if (updatedSchedule.enabled) {
      await this.scheduleNotification(updatedSchedule);
    }
    
    await this.saveSchedules();
  }

  async cancelSchedule(scheduleId: string): Promise<void> {
    await notifee.cancelNotification(scheduleId);
    this.schedules.delete(scheduleId);
    await this.saveSchedules();
  }

  async cancelAllScheduled(): Promise<void> {
    const notifications = await notifee.getTriggerNotificationIds();
    for (const id of notifications) {
      await notifee.cancelNotification(id);
    }
  }

  private async rescheduleAll(): Promise<void> {
    for (const schedule of this.schedules.values()) {
      if (schedule.enabled) {
        await this.scheduleNotification(schedule);
      }
    }
  }

  private getDefaultTime(hour: number, minute: number): Date {
    const date = new Date();
    date.setHours(hour, minute, 0, 0);
    
    if (date <= new Date()) {
      date.setDate(date.getDate() + 1);
    }
    
    return date;
  }

  private getNextSunday(hour: number, minute: number): Date {
    const date = new Date();
    const day = date.getDay();
    const diff = 7 - day; // Days until Sunday
    
    date.setDate(date.getDate() + diff);
    date.setHours(hour, minute, 0, 0);
    
    if (date <= new Date()) {
      date.setDate(date.getDate() + 7);
    }
    
    return date;
  }

  private getNextWeeklyOccurrence(dayOfWeek: number, time: string): Date {
    const [hours, minutes] = time.split(':').map(Number);
    const date = new Date();
    const currentDay = date.getDay();
    
    let daysUntilNext = dayOfWeek - currentDay;
    if (daysUntilNext <= 0) {
      daysUntilNext += 7;
    }
    
    date.setDate(date.getDate() + daysUntilNext);
    date.setHours(hours, minutes, 0, 0);
    
    if (date <= new Date()) {
      date.setDate(date.getDate() + 7);
    }
    
    return date;
  }

  private getNextMonthlyOccurrence(dayOfMonth: number, time: string): Date {
    const [hours, minutes] = time.split(':').map(Number);
    const date = new Date();
    
    date.setDate(dayOfMonth);
    date.setHours(hours, minutes, 0, 0);
    
    if (date <= new Date()) {
      date.setMonth(date.getMonth() + 1);
    }
    
    return date;
  }

  async triggerTestNotification(type: NotificationType): Promise<void> {
    const testSchedule: NotificationSchedule = {
      id: `test-${Date.now()}`,
      userId: 'current-user',
      notificationType: type,
      scheduledTime: new Date(),
      recurring: false,
      enabled: true,
    };

    const notification = await this.createNotificationContent(testSchedule);
    await notifee.displayNotification(notification);
  }

  private async loadSchedules(): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem(SCHEDULES_KEY);
      if (stored) {
        const schedules = JSON.parse(stored);
        this.schedules = new Map(
          schedules.map((schedule: NotificationSchedule) => {
            schedule.scheduledTime = new Date(schedule.scheduledTime);
            if (schedule.lastSentDate) {
              schedule.lastSentDate = new Date(schedule.lastSentDate);
            }
            return [schedule.id, schedule];
          })
        );
      }
    } catch (error) {
      console.error('Error loading schedules:', error);
    }
  }

  private async saveSchedules(): Promise<void> {
    const schedules = Array.from(this.schedules.values());
    await AsyncStorage.setItem(SCHEDULES_KEY, JSON.stringify(schedules));
  }

  private async loadPreferences(): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem(PREFERENCES_KEY);
      if (stored) {
        this.preferences = JSON.parse(stored);
      }
    } catch (error) {
      console.error('Error loading preferences:', error);
    }
  }

  private async savePreferences(): Promise<void> {
    await AsyncStorage.setItem(PREFERENCES_KEY, JSON.stringify(this.preferences));
  }

  getSchedules(): NotificationSchedule[] {
    return Array.from(this.schedules.values());
  }

  getPreferences(): NotificationPreferences {
    return this.preferences;
  }
}

export default NotificationScheduler.getInstance();