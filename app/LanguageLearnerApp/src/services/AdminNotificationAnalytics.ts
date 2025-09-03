import AsyncStorage from '@react-native-async-storage/async-storage';
import {NotificationType} from '../types/notifications';

const ADMIN_ANALYTICS_KEY = '@admin_notification_analytics';

export interface AdminNotificationStats {
  totalNotificationsSent: number;
  totalUsersWithNotifications: number;
  globalEngagementRate: number;
  averageResponseTime: number;
  notificationsByType: Record<NotificationType, number>;
  engagementByType: Record<NotificationType, number>;
  peakHours: Array<{hour: number; count: number}>;
  userSegmentation: {
    highlyEngaged: number;
    moderatelyEngaged: number;
    lowEngaged: number;
    inactive: number;
  };
  systemHealth: {
    deliveryRate: number;
    errorRate: number;
    averageDeliveryTime: number;
    lastUpdated: Date;
  };
  trends: {
    dailyGrowth: number;
    weeklyGrowth: number;
    monthlyGrowth: number;
    engagementTrend: 'up' | 'down' | 'stable';
  };
}

export interface NotificationCampaignStats {
  id: string;
  name: string;
  type: NotificationType;
  targetUsers: number;
  sentCount: number;
  openedCount: number;
  actionCount: number;
  engagementRate: number;
  createdAt: Date;
  status: 'active' | 'completed' | 'paused' | 'failed';
}

export interface UserEngagementInsight {
  segment: 'highly_engaged' | 'moderately_engaged' | 'low_engaged' | 'inactive';
  count: number;
  percentage: number;
  averageEngagement: number;
  preferredTime: string;
  mostEngagedCategory: NotificationType;
  characteristics: string[];
}

export interface NotificationHealthMetric {
  metric: string;
  value: number;
  status: 'healthy' | 'warning' | 'critical';
  threshold: number;
  description: string;
  trend: 'improving' | 'declining' | 'stable';
  lastChecked: Date;
}

export interface PlatformPerformance {
  platform: 'ios' | 'android';
  totalUsers: number;
  notificationsSent: number;
  deliveryRate: number;
  engagementRate: number;
  averageResponseTime: number;
}

export class AdminNotificationAnalytics {
  private static instance: AdminNotificationAnalytics;
  private stats: AdminNotificationStats | null = null;
  private campaigns: NotificationCampaignStats[] = [];
  private healthMetrics: NotificationHealthMetric[] = [];

  private constructor() {}

  static getInstance(): AdminNotificationAnalytics {
    if (!AdminNotificationAnalytics.instance) {
      AdminNotificationAnalytics.instance = new AdminNotificationAnalytics();
    }
    return AdminNotificationAnalytics.instance;
  }

  async initialize(): Promise<void> {
    await this.loadData();
    await this.generateMockData(); // Remove in production
  }

  private async generateMockData(): Promise<void> {
    // Mock data for demonstration - in production, this would come from server
    const mockStats: AdminNotificationStats = {
      totalNotificationsSent: 45250,
      totalUsersWithNotifications: 1847,
      globalEngagementRate: 67.3,
      averageResponseTime: 1440, // 24 minutes in seconds
      notificationsByType: {
        [NotificationType.LEARNING_REMINDER]: 15680,
        [NotificationType.STREAK_REMINDER]: 8920,
        [NotificationType.SRS_REVIEW]: 12340,
        [NotificationType.GOAL_ACHIEVED]: 3420,
        [NotificationType.MILESTONE_REACHED]: 1890,
        [NotificationType.NEW_CONTENT]: 2100,
        [NotificationType.WEEKLY_PROGRESS]: 540,
        [NotificationType.OPTIMAL_TIME]: 280,
        [NotificationType.ENCOURAGEMENT]: 80,
      },
      engagementByType: {
        [NotificationType.LEARNING_REMINDER]: 72.5,
        [NotificationType.STREAK_REMINDER]: 85.2,
        [NotificationType.SRS_REVIEW]: 78.9,
        [NotificationType.GOAL_ACHIEVED]: 92.1,
        [NotificationType.MILESTONE_REACHED]: 94.7,
        [NotificationType.NEW_CONTENT]: 56.3,
        [NotificationType.WEEKLY_PROGRESS]: 68.4,
        [NotificationType.OPTIMAL_TIME]: 81.7,
        [NotificationType.ENCOURAGEMENT]: 64.2,
      },
      peakHours: [
        {hour: 7, count: 3240},
        {hour: 8, count: 4180},
        {hour: 9, count: 2890},
        {hour: 18, count: 3560},
        {hour: 19, count: 4720},
        {hour: 20, count: 3890},
        {hour: 21, count: 2340},
      ],
      userSegmentation: {
        highlyEngaged: 512, // 27.7%
        moderatelyEngaged: 739, // 40.0%
        lowEngaged: 441, // 23.9%
        inactive: 155, // 8.4%
      },
      systemHealth: {
        deliveryRate: 98.7,
        errorRate: 1.3,
        averageDeliveryTime: 2.4,
        lastUpdated: new Date(),
      },
      trends: {
        dailyGrowth: 2.3,
        weeklyGrowth: 8.7,
        monthlyGrowth: 23.4,
        engagementTrend: 'up',
      },
    };

    this.stats = mockStats;
    await this.saveData();
  }

  async getOverviewStats(): Promise<AdminNotificationStats | null> {
    if (!this.stats) {
      await this.initialize();
    }
    return this.stats;
  }

  async getUserEngagementInsights(): Promise<UserEngagementInsight[]> {
    if (!this.stats) return [];

    const total = this.stats.totalUsersWithNotifications;
    
    return [
      {
        segment: 'highly_engaged',
        count: this.stats.userSegmentation.highlyEngaged,
        percentage: (this.stats.userSegmentation.highlyEngaged / total) * 100,
        averageEngagement: 87.3,
        preferredTime: '19:00',
        mostEngagedCategory: NotificationType.GOAL_ACHIEVED,
        characteristics: [
          'Complete lessons daily',
          'High SRS review completion',
          'Active during evening hours',
          'Respond quickly to notifications'
        ],
      },
      {
        segment: 'moderately_engaged',
        count: this.stats.userSegmentation.moderatelyEngaged,
        percentage: (this.stats.userSegmentation.moderatelyEngaged / total) * 100,
        averageEngagement: 58.7,
        preferredTime: '08:00',
        mostEngagedCategory: NotificationType.LEARNING_REMINDER,
        characteristics: [
          'Study 3-4 times per week',
          'Prefer morning notifications',
          'Mixed response to different categories',
          'Occasional streak breaks'
        ],
      },
      {
        segment: 'low_engaged',
        count: this.stats.userSegmentation.lowEngaged,
        percentage: (this.stats.userSegmentation.lowEngaged / total) * 100,
        averageEngagement: 32.1,
        preferredTime: '20:00',
        mostEngagedCategory: NotificationType.STREAK_REMINDER,
        characteristics: [
          'Irregular learning patterns',
          'Low notification response rate',
          'Prefer achievement notifications',
          'Often have quiet hours enabled'
        ],
      },
      {
        segment: 'inactive',
        count: this.stats.userSegmentation.inactive,
        percentage: (this.stats.userSegmentation.inactive / total) * 100,
        averageEngagement: 8.4,
        preferredTime: 'N/A',
        mostEngagedCategory: NotificationType.NEW_CONTENT,
        characteristics: [
          'Rarely open notifications',
          'No recent learning activity',
          'May have disabled most categories',
          'Potential churn risk'
        ],
      },
    ];
  }

  async getHealthMetrics(): Promise<NotificationHealthMetric[]> {
    const metrics: NotificationHealthMetric[] = [
      {
        metric: 'Global Engagement Rate',
        value: this.stats?.globalEngagementRate || 0,
        status: (this.stats?.globalEngagementRate || 0) > 60 ? 'healthy' : 
               (this.stats?.globalEngagementRate || 0) > 40 ? 'warning' : 'critical',
        threshold: 60,
        description: 'Percentage of users who engage with notifications',
        trend: this.stats?.trends.engagementTrend === 'up' ? 'improving' : 
               this.stats?.trends.engagementTrend === 'down' ? 'declining' : 'stable',
        lastChecked: new Date(),
      },
      {
        metric: 'Delivery Success Rate',
        value: this.stats?.systemHealth.deliveryRate || 0,
        status: (this.stats?.systemHealth.deliveryRate || 0) > 95 ? 'healthy' : 
               (this.stats?.systemHealth.deliveryRate || 0) > 90 ? 'warning' : 'critical',
        threshold: 95,
        description: 'Percentage of notifications successfully delivered',
        trend: 'stable',
        lastChecked: new Date(),
      },
      {
        metric: 'Average Response Time',
        value: (this.stats?.averageResponseTime || 0) / 60, // Convert to minutes
        status: (this.stats?.averageResponseTime || 0) < 3600 ? 'healthy' : 
               (this.stats?.averageResponseTime || 0) < 7200 ? 'warning' : 'critical',
        threshold: 60, // 1 hour in minutes
        description: 'Average time for users to respond to notifications',
        trend: 'improving',
        lastChecked: new Date(),
      },
      {
        metric: 'Error Rate',
        value: this.stats?.systemHealth.errorRate || 0,
        status: (this.stats?.systemHealth.errorRate || 0) < 2 ? 'healthy' : 
               (this.stats?.systemHealth.errorRate || 0) < 5 ? 'warning' : 'critical',
        threshold: 2,
        description: 'Percentage of notification delivery failures',
        trend: 'stable',
        lastChecked: new Date(),
      },
      {
        metric: 'User Growth Rate',
        value: this.stats?.trends.monthlyGrowth || 0,
        status: (this.stats?.trends.monthlyGrowth || 0) > 10 ? 'healthy' : 
               (this.stats?.trends.monthlyGrowth || 0) > 0 ? 'warning' : 'critical',
        threshold: 10,
        description: 'Monthly growth rate of active notification users',
        trend: 'improving',
        lastChecked: new Date(),
      },
    ];

    this.healthMetrics = metrics;
    return metrics;
  }

  async getCampaignStats(): Promise<NotificationCampaignStats[]> {
    // Mock campaign data
    const mockCampaigns: NotificationCampaignStats[] = [
      {
        id: 'camp_001',
        name: 'New Year Learning Challenge',
        type: NotificationType.GOAL_ACHIEVED,
        targetUsers: 1200,
        sentCount: 1180,
        openedCount: 1089,
        actionCount: 856,
        engagementRate: 92.3,
        createdAt: new Date('2024-01-01'),
        status: 'completed',
      },
      {
        id: 'camp_002',
        name: 'Weekend Review Reminders',
        type: NotificationType.SRS_REVIEW,
        targetUsers: 850,
        sentCount: 2340, // Multiple sends
        openedCount: 1847,
        actionCount: 1456,
        engagementRate: 78.9,
        createdAt: new Date('2024-02-15'),
        status: 'active',
      },
      {
        id: 'camp_003',
        name: 'Streak Recovery Program',
        type: NotificationType.STREAK_REMINDER,
        targetUsers: 340,
        sentCount: 680,
        openedCount: 579,
        actionCount: 387,
        engagementRate: 85.1,
        createdAt: new Date('2024-03-01'),
        status: 'active',
      },
    ];

    this.campaigns = mockCampaigns;
    return mockCampaigns;
  }

  async getPlatformPerformance(): Promise<PlatformPerformance[]> {
    return [
      {
        platform: 'ios',
        totalUsers: 1012,
        notificationsSent: 24680,
        deliveryRate: 99.2,
        engagementRate: 69.4,
        averageResponseTime: 1320,
      },
      {
        platform: 'android',
        totalUsers: 835,
        notificationsSent: 20570,
        deliveryRate: 98.1,
        engagementRate: 64.8,
        averageResponseTime: 1580,
      },
    ];
  }

  async getTopPerformingNotifications(): Promise<Array<{
    type: NotificationType;
    title: string;
    engagementRate: number;
    totalSent: number;
    bestTime: string;
    improvement: number;
  }>> {
    if (!this.stats) return [];

    return [
      {
        type: NotificationType.MILESTONE_REACHED,
        title: 'Milestone Celebrations',
        engagementRate: this.stats.engagementByType[NotificationType.MILESTONE_REACHED],
        totalSent: this.stats.notificationsByType[NotificationType.MILESTONE_REACHED],
        bestTime: '19:30',
        improvement: 12.3,
      },
      {
        type: NotificationType.GOAL_ACHIEVED,
        title: 'Goal Achievements',
        engagementRate: this.stats.engagementByType[NotificationType.GOAL_ACHIEVED],
        totalSent: this.stats.notificationsByType[NotificationType.GOAL_ACHIEVED],
        bestTime: '20:15',
        improvement: 8.7,
      },
      {
        type: NotificationType.STREAK_REMINDER,
        title: 'Streak Maintenance',
        engagementRate: this.stats.engagementByType[NotificationType.STREAK_REMINDER],
        totalSent: this.stats.notificationsByType[NotificationType.STREAK_REMINDER],
        bestTime: '21:00',
        improvement: 5.4,
      },
    ];
  }

  async getNotificationTrends(days: number = 30): Promise<Array<{
    date: string;
    sent: number;
    opened: number;
    engaged: number;
  }>> {
    // Mock trend data
    const trends = [];
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    for (let i = 0; i < days; i++) {
      const date = new Date(startDate);
      date.setDate(date.getDate() + i);
      
      const baseSent = 1200 + Math.random() * 800;
      const opened = Math.floor(baseSent * (0.6 + Math.random() * 0.3));
      const engaged = Math.floor(opened * (0.4 + Math.random() * 0.4));

      trends.push({
        date: date.toISOString().split('T')[0],
        sent: Math.floor(baseSent),
        opened,
        engaged,
      });
    }

    return trends;
  }

  async getQuietHoursImpact(): Promise<{
    usersWithQuietHours: number;
    averageQuietDuration: number; // hours
    blockedNotifications: number;
    delayedNotifications: number;
    categoryMostAffected: NotificationType;
    peakQuietTime: string;
  }> {
    return {
      usersWithQuietHours: 1456,
      averageQuietDuration: 8.5,
      blockedNotifications: 3240,
      delayedNotifications: 1890,
      categoryMostAffected: NotificationType.LEARNING_REMINDER,
      peakQuietTime: '22:00-07:00',
    };
  }

  async getActionableInsights(): Promise<Array<{
    type: 'opportunity' | 'warning' | 'critical';
    title: string;
    description: string;
    impact: 'high' | 'medium' | 'low';
    action: string;
    expectedImprovement: string;
  }>> {
    return [
      {
        type: 'opportunity',
        title: 'Optimize New Content Notifications',
        description: 'New content notifications have the lowest engagement rate (56.3%)',
        impact: 'high',
        action: 'A/B test different messaging and timing for new content alerts',
        expectedImprovement: '+15-20% engagement rate',
      },
      {
        type: 'warning',
        title: 'Inactive User Segment Growing',
        description: '155 users (8.4%) are inactive, up from 6.2% last month',
        impact: 'medium',
        action: 'Create re-engagement campaign for inactive users',
        expectedImprovement: 'Reduce churn by 30%',
      },
      {
        type: 'opportunity',
        title: 'Peak Hour Optimization',
        description: '19:00 shows highest engagement but is underutilized',
        impact: 'medium',
        action: 'Increase notification scheduling during 19:00-20:00 window',
        expectedImprovement: '+8-12% overall engagement',
      },
      {
        type: 'critical',
        title: 'Android Delivery Issues',
        description: 'Android delivery rate (98.1%) is below iOS (99.2%)',
        impact: 'high',
        action: 'Investigate Android notification delivery pipeline',
        expectedImprovement: 'Reduce delivery failures by 50%',
      },
    ];
  }

  private async loadData(): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem(ADMIN_ANALYTICS_KEY);
      if (stored) {
        const data = JSON.parse(stored);
        if (data.stats) {
          this.stats = {
            ...data.stats,
            systemHealth: {
              ...data.stats.systemHealth,
              lastUpdated: new Date(data.stats.systemHealth.lastUpdated),
            },
          };
        }
        if (data.campaigns) {
          this.campaigns = data.campaigns.map((c: any) => ({
            ...c,
            createdAt: new Date(c.createdAt),
          }));
        }
      }
    } catch (error) {
      console.error('Error loading admin analytics:', error);
    }
  }

  private async saveData(): Promise<void> {
    try {
      const data = {
        stats: this.stats,
        campaigns: this.campaigns,
        lastUpdated: new Date().toISOString(),
      };
      await AsyncStorage.setItem(ADMIN_ANALYTICS_KEY, JSON.stringify(data));
    } catch (error) {
      console.error('Error saving admin analytics:', error);
    }
  }

  async refreshStats(): Promise<void> {
    // In production, this would fetch fresh data from server
    await this.generateMockData();
  }
}

export default AdminNotificationAnalytics.getInstance();