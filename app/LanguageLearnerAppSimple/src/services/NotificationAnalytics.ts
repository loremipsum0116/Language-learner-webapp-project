import AsyncStorage from '@react-native-async-storage/async-storage';
import {NotificationType, NotificationAnalytics} from '../types/notifications';

const ANALYTICS_KEY = '@notification_analytics';
const ANALYTICS_SETTINGS_KEY = '@notification_analytics_settings';

export interface NotificationEngagementData {
  sent: number;
  opened: number;
  dismissed: number;
  actionTaken: number;
  engagementRate: number;
  averageResponseTime: number; // seconds
}

export interface NotificationTiming {
  hour: number;
  count: number;
  engagementRate: number;
}

export interface NotificationFrequency {
  type: NotificationType;
  daily: number;
  weekly: number;
  monthly: number;
  trend: 'increasing' | 'decreasing' | 'stable';
}

export interface AnalyticsSettings {
  trackingEnabled: boolean;
  retentionDays: number;
  shareAnonymousData: boolean;
  detailedTracking: boolean;
}

export interface AnalyticsSummary {
  totalNotifications: number;
  overallEngagementRate: number;
  topPerformingCategory: string;
  optimalDeliveryTime: string;
  weeklyTrend: 'up' | 'down' | 'stable';
  userSegment: 'highly_engaged' | 'moderately_engaged' | 'low_engaged';
  recommendations: string[];
}

export class NotificationAnalyticsService {
  private static instance: NotificationAnalyticsService;
  private analytics: Map<string, NotificationAnalytics> = new Map();
  private settings: AnalyticsSettings = {
    trackingEnabled: true,
    retentionDays: 90,
    shareAnonymousData: false,
    detailedTracking: true,
  };

  private constructor() {}

  static getInstance(): NotificationAnalyticsService {
    if (!NotificationAnalyticsService.instance) {
      NotificationAnalyticsService.instance = new NotificationAnalyticsService();
    }
    return NotificationAnalyticsService.instance;
  }

  async initialize(): Promise<void> {
    await this.loadAnalytics();
    await this.loadSettings();
    await this.cleanupOldData();
  }

  async trackNotificationSent(
    notificationId: string,
    type: NotificationType,
    userId: string
  ): Promise<void> {
    if (!this.settings.trackingEnabled) return;

    const analytics: NotificationAnalytics = {
      userId,
      notificationId,
      type,
      sentAt: new Date(),
      dismissed: false,
      engagementScore: 0,
    };

    this.analytics.set(notificationId, analytics);
    await this.saveAnalytics();
  }

  async trackNotificationOpened(
    notificationId: string,
    actionTaken?: string
  ): Promise<void> {
    if (!this.settings.trackingEnabled) return;

    const analytics = this.analytics.get(notificationId);
    if (analytics) {
      analytics.openedAt = new Date();
      analytics.actionTaken = actionTaken;
      analytics.engagementScore = this.calculateEngagementScore(analytics);
      
      this.analytics.set(notificationId, analytics);
      await this.saveAnalytics();
    }
  }

  async trackNotificationDismissed(notificationId: string): Promise<void> {
    if (!this.settings.trackingEnabled) return;

    const analytics = this.analytics.get(notificationId);
    if (analytics) {
      analytics.dismissed = true;
      analytics.engagementScore = this.calculateEngagementScore(analytics);
      
      this.analytics.set(notificationId, analytics);
      await this.saveAnalytics();
    }
  }

  private calculateEngagementScore(analytics: NotificationAnalytics): number {
    let score = 0;

    // Base score for receiving notification
    score += 10;

    // Score for opening
    if (analytics.openedAt) {
      score += 30;

      // Bonus for quick response
      const responseTime = analytics.openedAt.getTime() - analytics.sentAt.getTime();
      const hours = responseTime / (1000 * 60 * 60);
      
      if (hours < 1) score += 20;
      else if (hours < 4) score += 15;
      else if (hours < 24) score += 10;
    }

    // Score for taking action
    if (analytics.actionTaken) {
      score += 40;
      
      // Bonus for specific beneficial actions
      if (analytics.actionTaken === 'start_lesson') score += 20;
      else if (analytics.actionTaken === 'complete_review') score += 15;
      else if (analytics.actionTaken === 'set_goal') score += 10;
    }

    // Penalty for dismissing without action
    if (analytics.dismissed && !analytics.openedAt) {
      score -= 10;
    }

    return Math.max(0, Math.min(100, score));
  }

  async getEngagementData(
    type?: NotificationType,
    days: number = 30
  ): Promise<NotificationEngagementData> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    const relevantAnalytics = Array.from(this.analytics.values()).filter(
      a =>
        a.sentAt >= cutoffDate &&
        (!type || a.type === type)
    );

    const sent = relevantAnalytics.length;
    const opened = relevantAnalytics.filter(a => a.openedAt).length;
    const dismissed = relevantAnalytics.filter(a => a.dismissed).length;
    const actionTaken = relevantAnalytics.filter(a => a.actionTaken).length;

    const responseTimes = relevantAnalytics
      .filter(a => a.openedAt)
      .map(a => (a.openedAt!.getTime() - a.sentAt.getTime()) / 1000);

    return {
      sent,
      opened,
      dismissed,
      actionTaken,
      engagementRate: sent > 0 ? (opened / sent) * 100 : 0,
      averageResponseTime:
        responseTimes.length > 0
          ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
          : 0,
    };
  }

  async getTimingAnalysis(days: number = 30): Promise<NotificationTiming[]> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    const relevantAnalytics = Array.from(this.analytics.values()).filter(
      a => a.sentAt >= cutoffDate
    );

    const hourlyData = new Map<number, {sent: number; opened: number}>();

    relevantAnalytics.forEach(analytics => {
      const hour = analytics.sentAt.getHours();
      const current = hourlyData.get(hour) || {sent: 0, opened: 0};
      
      current.sent++;
      if (analytics.openedAt) current.opened++;
      
      hourlyData.set(hour, current);
    });

    return Array.from(hourlyData.entries()).map(([hour, data]) => ({
      hour,
      count: data.sent,
      engagementRate: data.sent > 0 ? (data.opened / data.sent) * 100 : 0,
    }));
  }

  async getFrequencyAnalysis(): Promise<NotificationFrequency[]> {
    const now = new Date();
    const oneDay = 24 * 60 * 60 * 1000;
    const oneWeek = 7 * oneDay;
    const oneMonth = 30 * oneDay;

    const allTypes = Object.values(NotificationType);
    const frequencies: NotificationFrequency[] = [];

    for (const type of allTypes) {
      const typeAnalytics = Array.from(this.analytics.values()).filter(
        a => a.type === type
      );

      const daily = typeAnalytics.filter(
        a => now.getTime() - a.sentAt.getTime() <= oneDay
      ).length;

      const weekly = typeAnalytics.filter(
        a => now.getTime() - a.sentAt.getTime() <= oneWeek
      ).length;

      const monthly = typeAnalytics.filter(
        a => now.getTime() - a.sentAt.getTime() <= oneMonth
      ).length;

      // Calculate trend (simplified)
      const lastWeek = typeAnalytics.filter(
        a =>
          now.getTime() - a.sentAt.getTime() <= oneWeek &&
          now.getTime() - a.sentAt.getTime() > oneWeek / 2
      ).length;

      const thisWeek = typeAnalytics.filter(
        a => now.getTime() - a.sentAt.getTime() <= oneWeek / 2
      ).length;

      let trend: 'increasing' | 'decreasing' | 'stable' = 'stable';
      if (thisWeek > lastWeek * 1.2) trend = 'increasing';
      else if (thisWeek < lastWeek * 0.8) trend = 'decreasing';

      frequencies.push({
        type,
        daily,
        weekly,
        monthly,
        trend,
      });
    }

    return frequencies;
  }

  async getAnalyticsSummary(): Promise<AnalyticsSummary> {
    const engagement = await this.getEngagementData(undefined, 30);
    const timingAnalysis = await this.getTimingAnalysis(30);
    const frequencies = await this.getFrequencyAnalysis();

    // Find optimal delivery time
    const optimalTiming = timingAnalysis.reduce((best, current) =>
      current.engagementRate > best.engagementRate ? current : best
    );

    // Find top performing category
    const categoryEngagement = new Map<NotificationType, number>();
    
    for (const type of Object.values(NotificationType)) {
      const typeEngagement = await this.getEngagementData(type, 30);
      categoryEngagement.set(type, typeEngagement.engagementRate);
    }

    const topCategory = Array.from(categoryEngagement.entries()).reduce(
      (best, current) => (current[1] > best[1] ? current : best)
    );

    // Determine user segment
    let userSegment: 'highly_engaged' | 'moderately_engaged' | 'low_engaged' =
      'low_engaged';
    
    if (engagement.engagementRate > 70) userSegment = 'highly_engaged';
    else if (engagement.engagementRate > 40) userSegment = 'moderately_engaged';

    // Generate recommendations
    const recommendations = this.generateRecommendations(
      engagement,
      timingAnalysis,
      frequencies
    );

    // Calculate weekly trend
    const thisWeekEngagement = await this.getEngagementData(undefined, 7);
    const lastWeekEngagement = await this.getEngagementData(undefined, 14);
    
    let weeklyTrend: 'up' | 'down' | 'stable' = 'stable';
    if (thisWeekEngagement.engagementRate > lastWeekEngagement.engagementRate * 1.1) {
      weeklyTrend = 'up';
    } else if (thisWeekEngagement.engagementRate < lastWeekEngagement.engagementRate * 0.9) {
      weeklyTrend = 'down';
    }

    return {
      totalNotifications: engagement.sent,
      overallEngagementRate: engagement.engagementRate,
      topPerformingCategory: this.getTypeDisplayName(topCategory[0]),
      optimalDeliveryTime: `${optimalTiming.hour}:00`,
      weeklyTrend,
      userSegment,
      recommendations,
    };
  }

  private generateRecommendations(
    engagement: NotificationEngagementData,
    timing: NotificationTiming[],
    frequencies: NotificationFrequency[]
  ): string[] {
    const recommendations: string[] = [];

    // Engagement recommendations
    if (engagement.engagementRate < 30) {
      recommendations.push('Consider reducing notification frequency to improve engagement');
    } else if (engagement.engagementRate > 80) {
      recommendations.push('Great engagement! You might benefit from more personalized content');
    }

    // Timing recommendations
    const lowEngagementHours = timing.filter(t => t.engagementRate < 20);
    if (lowEngagementHours.length > 0) {
      recommendations.push(
        `Avoid sending notifications at ${lowEngagementHours[0].hour}:00 - low engagement`
      );
    }

    const bestHour = timing.reduce((best, current) =>
      current.engagementRate > best.engagementRate ? current : best
    );
    
    if (bestHour.engagementRate > 60) {
      recommendations.push(
        `${bestHour.hour}:00 is your optimal time - consider scheduling more notifications then`
      );
    }

    // Frequency recommendations
    const increasingTypes = frequencies.filter(f => f.trend === 'increasing');
    if (increasingTypes.length > 0) {
      recommendations.push(
        `${this.getTypeDisplayName(increasingTypes[0].type)} notifications are trending up`
      );
    }

    // Response time recommendations
    if (engagement.averageResponseTime > 3600) {
      // More than 1 hour
      recommendations.push('Try shorter, more actionable notification messages');
    }

    return recommendations;
  }

  private getTypeDisplayName(type: NotificationType): string {
    const displayNames = {
      [NotificationType.LEARNING_REMINDER]: 'Learning Reminders',
      [NotificationType.STREAK_REMINDER]: 'Streak Reminders',
      [NotificationType.SRS_REVIEW]: 'SRS Reviews',
      [NotificationType.GOAL_ACHIEVED]: 'Achievements',
      [NotificationType.MILESTONE_REACHED]: 'Milestones',
      [NotificationType.NEW_CONTENT]: 'New Content',
      [NotificationType.WEEKLY_PROGRESS]: 'Progress Reports',
      [NotificationType.OPTIMAL_TIME]: 'Optimal Time',
      [NotificationType.ENCOURAGEMENT]: 'Encouragement',
    };

    return displayNames[type] || type;
  }

  async exportAnalyticsData(): Promise<string> {
    const data = {
      analytics: Array.from(this.analytics.entries()),
      summary: await this.getAnalyticsSummary(),
      engagement: await this.getEngagementData(),
      timing: await this.getTimingAnalysis(),
      frequencies: await this.getFrequencyAnalysis(),
      exportedAt: new Date().toISOString(),
    };

    return JSON.stringify(data, null, 2);
  }

  async clearAnalyticsData(): Promise<void> {
    this.analytics.clear();
    await this.saveAnalytics();
  }

  async updateSettings(settings: Partial<AnalyticsSettings>): Promise<void> {
    this.settings = {...this.settings, ...settings};
    await this.saveSettings();
    
    if (!settings.trackingEnabled) {
      await this.clearAnalyticsData();
    }
  }

  private async cleanupOldData(): Promise<void> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.settings.retentionDays);

    const beforeSize = this.analytics.size;
    
    for (const [id, analytics] of this.analytics.entries()) {
      if (analytics.sentAt < cutoffDate) {
        this.analytics.delete(id);
      }
    }

    if (this.analytics.size < beforeSize) {
      await this.saveAnalytics();
    }
  }

  private async loadAnalytics(): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem(ANALYTICS_KEY);
      if (stored) {
        const data = JSON.parse(stored);
        this.analytics = new Map(
          data.map((item: any) => {
            item[1].sentAt = new Date(item[1].sentAt);
            if (item[1].openedAt) {
              item[1].openedAt = new Date(item[1].openedAt);
            }
            return [item[0], item[1]];
          })
        );
      }
    } catch (error) {
      console.error('Error loading analytics:', error);
    }
  }

  private async saveAnalytics(): Promise<void> {
    try {
      const data = Array.from(this.analytics.entries());
      await AsyncStorage.setItem(ANALYTICS_KEY, JSON.stringify(data));
    } catch (error) {
      console.error('Error saving analytics:', error);
    }
  }

  private async loadSettings(): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem(ANALYTICS_SETTINGS_KEY);
      if (stored) {
        this.settings = JSON.parse(stored);
      }
    } catch (error) {
      console.error('Error loading analytics settings:', error);
    }
  }

  private async saveSettings(): Promise<void> {
    try {
      await AsyncStorage.setItem(
        ANALYTICS_SETTINGS_KEY,
        JSON.stringify(this.settings)
      );
    } catch (error) {
      console.error('Error saving analytics settings:', error);
    }
  }

  getSettings(): AnalyticsSettings {
    return {...this.settings};
  }
}

export default NotificationAnalyticsService.getInstance();