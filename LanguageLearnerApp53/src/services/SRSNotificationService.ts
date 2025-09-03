import AsyncStorage from '@react-native-async-storage/async-storage';
import notifee, {
  TimestampTrigger,
  TriggerType,
  AndroidImportance,
} from '@notifee/react-native';
import {SRSReviewItem} from '../types/notifications';

const SRS_ITEMS_KEY = '@srs_review_items';
const SRS_SETTINGS_KEY = '@srs_settings';

interface SRSSettings {
  enabled: boolean;
  dailyReviewLimit: number;
  notificationTime: string; // HH:mm format
  adaptiveTiming: boolean;
}

export class SRSNotificationService {
  private static instance: SRSNotificationService;
  private reviewItems: Map<string, SRSReviewItem> = new Map();
  private settings: SRSSettings = {
    enabled: true,
    dailyReviewLimit: 20,
    notificationTime: '09:00',
    adaptiveTiming: true,
  };

  private readonly intervals = [1, 3, 7, 14, 30, 60, 120]; // Days

  private constructor() {}

  static getInstance(): SRSNotificationService {
    if (!SRSNotificationService.instance) {
      SRSNotificationService.instance = new SRSNotificationService();
    }
    return SRSNotificationService.instance;
  }

  async initialize(): Promise<void> {
    await this.loadReviewItems();
    await this.loadSettings();
    await this.createNotificationChannel();
    await this.scheduleUpcomingReviews();
  }

  private async createNotificationChannel(): Promise<void> {
    await notifee.createChannel({
      id: 'srs-reviews',
      name: 'SRS Reviews',
      importance: AndroidImportance.HIGH,
      sound: 'default',
    });
  }

  async addReviewItem(item: Omit<SRSReviewItem, 'id'>): Promise<void> {
    const id = `srs_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const reviewItem: SRSReviewItem = {
      ...item,
      id,
      nextReviewDate: new Date(),
      interval: 1,
      easeFactor: 2.5,
      repetitions: 0,
    };

    this.reviewItems.set(id, reviewItem);
    await this.saveReviewItems();
    await this.scheduleReviewNotification(reviewItem);
  }

  async processReview(
    itemId: string,
    quality: number // 0-5 (0=complete blackout, 5=perfect recall)
  ): Promise<void> {
    const item = this.reviewItems.get(itemId);
    if (!item) return;

    // SuperMemo 2 algorithm
    if (quality >= 3) {
      if (item.repetitions === 0) {
        item.interval = 1;
      } else if (item.repetitions === 1) {
        item.interval = 6;
      } else {
        item.interval = Math.round(item.interval * item.easeFactor);
      }
      item.repetitions++;
    } else {
      item.repetitions = 0;
      item.interval = 1;
    }

    item.easeFactor = Math.max(
      1.3,
      item.easeFactor + 0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02)
    );

    item.lastReviewDate = new Date();
    item.nextReviewDate = new Date();
    item.nextReviewDate.setDate(
      item.nextReviewDate.getDate() + item.interval
    );

    this.reviewItems.set(itemId, item);
    await this.saveReviewItems();
    await this.scheduleReviewNotification(item);
  }

  private async scheduleReviewNotification(item: SRSReviewItem): Promise<void> {
    if (!this.settings.enabled) return;

    const notificationTime = this.parseNotificationTime(
      this.settings.notificationTime
    );
    const scheduledDate = new Date(item.nextReviewDate);
    scheduledDate.setHours(notificationTime.hours, notificationTime.minutes, 0, 0);

    if (scheduledDate <= new Date()) {
      return; // Don't schedule past notifications
    }

    const trigger: TimestampTrigger = {
      type: TriggerType.TIMESTAMP,
      timestamp: scheduledDate.getTime(),
    };

    await notifee.createTriggerNotification(
      {
        id: `srs-review-${item.id}`,
        title: '📚 Time for Review!',
        body: `Review your ${item.contentType}: ${this.getContentPreview(item)}`,
        data: {
          itemId: item.id,
          contentId: item.contentId,
          contentType: item.contentType,
        },
        android: {
          channelId: 'srs-reviews',
          importance: AndroidImportance.HIGH,
          pressAction: {
            id: 'review',
            launchActivity: 'default',
          },
          actions: [
            {
              title: 'Review Now',
              pressAction: {
                id: 'review-now',
              },
            },
            {
              title: 'Snooze',
              pressAction: {
                id: 'snooze',
              },
            },
          ],
        },
        ios: {
          sound: 'default',
          categoryId: 'srs-review',
        },
      },
      trigger
    );
  }

  private getContentPreview(item: SRSReviewItem): string {
    // This would fetch actual content from your database
    switch (item.contentType) {
      case 'vocabulary':
        return 'vocabulary word';
      case 'grammar':
        return 'grammar pattern';
      case 'phrase':
        return 'phrase';
      default:
        return 'content';
    }
  }

  async getDueReviews(): Promise<SRSReviewItem[]> {
    const now = new Date();
    const dueItems: SRSReviewItem[] = [];

    for (const item of this.reviewItems.values()) {
      if (new Date(item.nextReviewDate) <= now) {
        dueItems.push(item);
      }
    }

    return dueItems.slice(0, this.settings.dailyReviewLimit);
  }

  async getUpcomingReviews(days: number = 7): Promise<SRSReviewItem[]> {
    const future = new Date();
    future.setDate(future.getDate() + days);
    const now = new Date();

    const upcomingItems: SRSReviewItem[] = [];

    for (const item of this.reviewItems.values()) {
      const reviewDate = new Date(item.nextReviewDate);
      if (reviewDate > now && reviewDate <= future) {
        upcomingItems.push(item);
      }
    }

    return upcomingItems.sort(
      (a, b) => a.nextReviewDate.getTime() - b.nextReviewDate.getTime()
    );
  }

  async scheduleUpcomingReviews(): Promise<void> {
    const dueReviews = await this.getDueReviews();
    
    if (dueReviews.length > 0) {
      await this.sendBatchReviewNotification(dueReviews);
    }

    // Schedule next day's reviews
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowReviews = await this.getReviewsForDate(tomorrow);
    
    if (tomorrowReviews.length > 0) {
      await this.scheduleDailyReviewSummary(tomorrow, tomorrowReviews.length);
    }
  }

  private async getReviewsForDate(date: Date): Promise<SRSReviewItem[]> {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const reviews: SRSReviewItem[] = [];

    for (const item of this.reviewItems.values()) {
      const reviewDate = new Date(item.nextReviewDate);
      if (reviewDate >= startOfDay && reviewDate <= endOfDay) {
        reviews.push(item);
      }
    }

    return reviews;
  }

  private async sendBatchReviewNotification(items: SRSReviewItem[]): Promise<void> {
    const vocabularyCount = items.filter(i => i.contentType === 'vocabulary').length;
    const grammarCount = items.filter(i => i.contentType === 'grammar').length;
    const phraseCount = items.filter(i => i.contentType === 'phrase').length;

    let bodyText = `You have ${items.length} items ready for review`;
    const details: string[] = [];
    
    if (vocabularyCount > 0) details.push(`${vocabularyCount} words`);
    if (grammarCount > 0) details.push(`${grammarCount} grammar points`);
    if (phraseCount > 0) details.push(`${phraseCount} phrases`);
    
    if (details.length > 0) {
      bodyText += `: ${details.join(', ')}`;
    }

    await notifee.displayNotification({
      id: 'srs-batch-review',
      title: '🎯 Reviews Ready!',
      body: bodyText,
      android: {
        channelId: 'srs-reviews',
        importance: AndroidImportance.HIGH,
        badge: items.length,
        pressAction: {
          id: 'open-reviews',
          launchActivity: 'default',
        },
      },
      ios: {
        sound: 'default',
        badge: items.length,
      },
    });
  }

  private async scheduleDailyReviewSummary(
    date: Date,
    count: number
  ): Promise<void> {
    const notificationTime = this.parseNotificationTime(
      this.settings.notificationTime
    );
    
    const scheduledDate = new Date(date);
    scheduledDate.setHours(
      notificationTime.hours - 1, // One hour before review time
      notificationTime.minutes,
      0,
      0
    );

    const trigger: TimestampTrigger = {
      type: TriggerType.TIMESTAMP,
      timestamp: scheduledDate.getTime(),
    };

    await notifee.createTriggerNotification(
      {
        id: `srs-daily-summary-${date.toISOString().split('T')[0]}`,
        title: '📅 Tomorrow\'s Reviews',
        body: `You have ${count} items scheduled for review tomorrow. Get ready!`,
        android: {
          channelId: 'srs-reviews',
          importance: AndroidImportance.DEFAULT,
        },
        ios: {
          sound: 'default',
        },
      },
      trigger
    );
  }

  private parseNotificationTime(time: string): {hours: number; minutes: number} {
    const [hours, minutes] = time.split(':').map(Number);
    return {hours, minutes};
  }

  async updateSettings(settings: Partial<SRSSettings>): Promise<void> {
    this.settings = {...this.settings, ...settings};
    await AsyncStorage.setItem(SRS_SETTINGS_KEY, JSON.stringify(this.settings));
    
    if (settings.enabled === false) {
      await this.cancelAllSRSNotifications();
    } else if (settings.notificationTime) {
      await this.rescheduleAllNotifications();
    }
  }

  private async rescheduleAllNotifications(): Promise<void> {
    await this.cancelAllSRSNotifications();
    for (const item of this.reviewItems.values()) {
      await this.scheduleReviewNotification(item);
    }
  }

  private async cancelAllSRSNotifications(): Promise<void> {
    const notifications = await notifee.getTriggerNotificationIds();
    const srsNotifications = notifications.filter(id => id.startsWith('srs-'));
    
    for (const id of srsNotifications) {
      await notifee.cancelNotification(id);
    }
  }

  private async loadReviewItems(): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem(SRS_ITEMS_KEY);
      if (stored) {
        const items = JSON.parse(stored);
        this.reviewItems = new Map(
          items.map((item: SRSReviewItem) => {
            item.nextReviewDate = new Date(item.nextReviewDate);
            if (item.lastReviewDate) {
              item.lastReviewDate = new Date(item.lastReviewDate);
            }
            return [item.id, item];
          })
        );
      }
    } catch (error) {
      console.error('Error loading SRS items:', error);
    }
  }

  private async saveReviewItems(): Promise<void> {
    const items = Array.from(this.reviewItems.values());
    await AsyncStorage.setItem(SRS_ITEMS_KEY, JSON.stringify(items));
  }

  private async loadSettings(): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem(SRS_SETTINGS_KEY);
      if (stored) {
        this.settings = JSON.parse(stored);
      }
    } catch (error) {
      console.error('Error loading SRS settings:', error);
    }
  }

  getStatistics(): {
    totalItems: number;
    dueToday: number;
    dueTomorrow: number;
    dueThisWeek: number;
    averageEaseFactor: number;
  } {
    const now = new Date();
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const weekFromNow = new Date();
    weekFromNow.setDate(weekFromNow.getDate() + 7);

    let dueToday = 0;
    let dueTomorrow = 0;
    let dueThisWeek = 0;
    let totalEaseFactor = 0;

    for (const item of this.reviewItems.values()) {
      const reviewDate = new Date(item.nextReviewDate);
      
      if (reviewDate <= now) {
        dueToday++;
      } else if (reviewDate <= tomorrow) {
        dueTomorrow++;
      }
      
      if (reviewDate <= weekFromNow) {
        dueThisWeek++;
      }
      
      totalEaseFactor += item.easeFactor;
    }

    return {
      totalItems: this.reviewItems.size,
      dueToday,
      dueTomorrow,
      dueThisWeek,
      averageEaseFactor: this.reviewItems.size > 0 
        ? totalEaseFactor / this.reviewItems.size 
        : 2.5,
    };
  }
}

export default SRSNotificationService.getInstance();