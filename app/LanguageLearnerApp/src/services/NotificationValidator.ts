import QuietHoursService from './QuietHoursService';
import NotificationCategoryManager from './NotificationCategoryManager';
import {NotificationType, NotificationPriority} from '../types/notifications';

export interface NotificationValidationResult {
  canSend: boolean;
  reason?: string;
  suggestedAction?: string;
  delayUntil?: Date;
  alternativeChannel?: 'email' | 'in_app' | 'push_later';
}

export interface NotificationRequest {
  type: NotificationType;
  priority: NotificationPriority;
  title: string;
  body: string;
  scheduledTime?: Date;
  userTags?: string[];
  respectQuietHours?: boolean;
  bypassSettings?: boolean;
}

export class NotificationValidator {
  private static instance: NotificationValidator;

  private constructor() {}

  static getInstance(): NotificationValidator {
    if (!NotificationValidator.instance) {
      NotificationValidator.instance = new NotificationValidator();
    }
    return NotificationValidator.instance;
  }

  async validateNotification(
    request: NotificationRequest
  ): Promise<NotificationValidationResult> {
    const scheduledTime = request.scheduledTime || new Date();

    // Check if notifications are globally enabled
    const globalCheck = await this.checkGlobalSettings(request);
    if (!globalCheck.canSend) return globalCheck;

    // Check category settings
    const categoryCheck = await this.checkCategorySettings(request);
    if (!categoryCheck.canSend) return categoryCheck;

    // Check quiet hours
    const quietHoursCheck = await this.checkQuietHours(request, scheduledTime);
    if (!quietHoursCheck.canSend) return quietHoursCheck;

    // Check frequency limits
    const frequencyCheck = await this.checkFrequencyLimits(request);
    if (!frequencyCheck.canSend) return frequencyCheck;

    // Check user preferences
    const userPrefsCheck = await this.checkUserPreferences(request);
    if (!userPrefsCheck.canSend) return userPrefsCheck;

    // Check system constraints
    const systemCheck = await this.checkSystemConstraints(request, scheduledTime);
    if (!systemCheck.canSend) return systemCheck;

    return {canSend: true};
  }

  private async checkGlobalSettings(
    request: NotificationRequest
  ): Promise<NotificationValidationResult> {
    if (request.bypassSettings) {
      return {canSend: true};
    }

    const settings = NotificationCategoryManager.getSettings();
    
    if (!settings.globalEnabled) {
      return {
        canSend: false,
        reason: 'All notifications are disabled',
        suggestedAction: 'Enable notifications in settings',
        alternativeChannel: 'in_app',
      };
    }

    return {canSend: true};
  }

  private async checkCategorySettings(
    request: NotificationRequest
  ): Promise<NotificationValidationResult> {
    if (request.bypassSettings) {
      return {canSend: true};
    }

    const notificationSettings = NotificationCategoryManager.getNotificationSettings(
      request.type
    );

    if (!notificationSettings.enabled) {
      const category = notificationSettings.category;
      return {
        canSend: false,
        reason: `${category?.name || 'This category'} notifications are disabled`,
        suggestedAction: `Enable ${category?.name || 'category'} notifications in settings`,
        alternativeChannel: 'in_app',
      };
    }

    return {canSend: true};
  }

  private async checkQuietHours(
    request: NotificationRequest,
    scheduledTime: Date
  ): Promise<NotificationValidationResult> {
    if (request.bypassSettings || !request.respectQuietHours) {
      return {canSend: true};
    }

    const category = NotificationCategoryManager.getCategoryForType(request.type);
    const categoryId = category?.id || 'unknown';

    const canSend = QuietHoursService.canSendNotification(
      categoryId,
      request.priority,
      scheduledTime
    );

    if (!canSend) {
      const activeSchedules = QuietHoursService.getActiveQuietSchedules(scheduledTime);
      const nextQuietEnd = this.getNextQuietHoursEnd(scheduledTime);

      return {
        canSend: false,
        reason: `Quiet hours active: ${activeSchedules[0]?.name || 'Do not disturb'}`,
        suggestedAction: 'Notification will be delayed until quiet hours end',
        delayUntil: nextQuietEnd,
        alternativeChannel: 'in_app',
      };
    }

    return {canSend: true};
  }

  private getNextQuietHoursEnd(currentTime: Date): Date {
    const activeSchedules = QuietHoursService.getActiveQuietSchedules(currentTime);
    
    if (activeSchedules.length === 0) {
      return currentTime;
    }

    // Find the earliest end time among active schedules
    let earliestEnd: Date | null = null;

    for (const schedule of activeSchedules) {
      const endTime = this.parseTimeToDate(schedule.endTime, currentTime);
      
      // Handle overnight periods
      if (schedule.startTime > schedule.endTime) {
        if (currentTime.getHours() < 12) {
          // Early morning, end time is today
        } else {
          // Evening, end time is tomorrow
          endTime.setDate(endTime.getDate() + 1);
        }
      }

      if (!earliestEnd || endTime < earliestEnd) {
        earliestEnd = endTime;
      }
    }

    return earliestEnd || currentTime;
  }

  private parseTimeToDate(timeString: string, baseDate: Date): Date {
    const [hours, minutes] = timeString.split(':').map(Number);
    const date = new Date(baseDate);
    date.setHours(hours, minutes, 0, 0);
    return date;
  }

  private async checkFrequencyLimits(
    request: NotificationRequest
  ): Promise<NotificationValidationResult> {
    const category = NotificationCategoryManager.getCategoryForType(request.type);
    
    if (!category?.customSettings) {
      return {canSend: true};
    }

    const {maxPerDay, maxPerWeek} = category.customSettings;
    
    if (maxPerDay) {
      const todayCount = await this.getNotificationCount(request.type, 'day');
      if (todayCount >= maxPerDay) {
        return {
          canSend: false,
          reason: `Daily limit reached for ${category.name} (${maxPerDay}/day)`,
          suggestedAction: 'Try again tomorrow',
          alternativeChannel: 'in_app',
        };
      }
    }

    if (maxPerWeek) {
      const weekCount = await this.getNotificationCount(request.type, 'week');
      if (weekCount >= maxPerWeek) {
        return {
          canSend: false,
          reason: `Weekly limit reached for ${category.name} (${maxPerWeek}/week)`,
          suggestedAction: 'Try again next week',
          alternativeChannel: 'email',
        };
      }
    }

    return {canSend: true};
  }

  private async checkUserPreferences(
    request: NotificationRequest
  ): Promise<NotificationValidationResult> {
    // Check if user has specific tags that should block this notification
    if (request.userTags?.includes('notification_pause')) {
      return {
        canSend: false,
        reason: 'User has temporarily paused notifications',
        suggestedAction: 'Notification paused by user',
        alternativeChannel: 'in_app',
      };
    }

    // Check optimal timing preferences
    const now = new Date();
    const hour = now.getHours();

    // Avoid very early morning or very late night unless urgent
    if (request.priority !== NotificationPriority.URGENT) {
      if (hour < 6 || hour > 23) {
        const nextMorning = new Date();
        nextMorning.setHours(8, 0, 0, 0);
        if (nextMorning <= now) {
          nextMorning.setDate(nextMorning.getDate() + 1);
        }

        return {
          canSend: false,
          reason: 'Outside recommended hours (6 AM - 11 PM)',
          suggestedAction: 'Will be delivered in the morning',
          delayUntil: nextMorning,
        };
      }
    }

    return {canSend: true};
  }

  private async checkSystemConstraints(
    request: NotificationRequest,
    scheduledTime: Date
  ): Promise<NotificationValidationResult> {
    const now = new Date();

    // Don't send notifications too far in the past
    if (scheduledTime < new Date(now.getTime() - 5 * 60 * 1000)) {
      return {
        canSend: false,
        reason: 'Notification is too old to send',
        suggestedAction: 'Notification expired',
      };
    }

    // Don't send notifications too far in the future without scheduling
    const maxFutureTime = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days
    if (scheduledTime > maxFutureTime) {
      return {
        canSend: false,
        reason: 'Notification scheduled too far in the future',
        suggestedAction: 'Use notification scheduling service',
      };
    }

    // Check if device might be in do not disturb mode (platform specific)
    if (await this.isDeviceInDoNotDisturb()) {
      if (request.priority !== NotificationPriority.URGENT) {
        return {
          canSend: false,
          reason: 'Device is in Do Not Disturb mode',
          suggestedAction: 'Will be shown when DND is disabled',
          alternativeChannel: 'in_app',
        };
      }
    }

    return {canSend: true};
  }

  private async getNotificationCount(
    type: NotificationType,
    period: 'day' | 'week' | 'month'
  ): Promise<number> {
    // This would typically query a notification history database
    // For now, return mock data
    const mockCounts = {
      day: {
        [NotificationType.LEARNING_REMINDER]: 2,
        [NotificationType.SRS_REVIEW]: 5,
        [NotificationType.NEW_CONTENT]: 1,
      },
      week: {
        [NotificationType.LEARNING_REMINDER]: 12,
        [NotificationType.SRS_REVIEW]: 25,
        [NotificationType.NEW_CONTENT]: 3,
      },
      month: {
        [NotificationType.LEARNING_REMINDER]: 45,
        [NotificationType.SRS_REVIEW]: 100,
        [NotificationType.NEW_CONTENT]: 8,
      },
    };

    return mockCounts[period][type] || 0;
  }

  private async isDeviceInDoNotDisturb(): Promise<boolean> {
    // This would check platform-specific DND status
    // Implementation would vary by platform
    return false;
  }

  async getBatchValidationResult(
    requests: NotificationRequest[]
  ): Promise<{
    approved: NotificationRequest[];
    rejected: Array<{request: NotificationRequest; result: NotificationValidationResult}>;
    delayed: Array<{request: NotificationRequest; delayUntil: Date}>;
  }> {
    const approved: NotificationRequest[] = [];
    const rejected: Array<{request: NotificationRequest; result: NotificationValidationResult}> = [];
    const delayed: Array<{request: NotificationRequest; delayUntil: Date}> = [];

    for (const request of requests) {
      const result = await this.validateNotification(request);
      
      if (result.canSend) {
        approved.push(request);
      } else if (result.delayUntil) {
        delayed.push({request, delayUntil: result.delayUntil});
      } else {
        rejected.push({request, result});
      }
    }

    return {approved, rejected, delayed};
  }

  async validateAndSuggestOptimalTime(
    request: NotificationRequest
  ): Promise<{
    canSendNow: boolean;
    optimalTime?: Date;
    reason?: string;
  }> {
    const validation = await this.validateNotification(request);
    
    if (validation.canSend) {
      return {canSendNow: true};
    }

    if (validation.delayUntil) {
      return {
        canSendNow: false,
        optimalTime: validation.delayUntil,
        reason: validation.reason,
      };
    }

    // Suggest next available time slot
    const nextSlot = await this.findNextAvailableSlot(request);
    return {
      canSendNow: false,
      optimalTime: nextSlot,
      reason: validation.reason,
    };
  }

  private async findNextAvailableSlot(request: NotificationRequest): Promise<Date> {
    const now = new Date();
    const maxTries = 7 * 24; // Check up to 7 days ahead, hour by hour
    
    for (let i = 1; i < maxTries; i++) {
      const testTime = new Date(now.getTime() + i * 60 * 60 * 1000);
      const testRequest = {...request, scheduledTime: testTime};
      
      const result = await this.validateNotification(testRequest);
      if (result.canSend) {
        return testTime;
      }
    }

    // Fallback: 1 week from now at 9 AM
    const fallback = new Date();
    fallback.setDate(fallback.getDate() + 7);
    fallback.setHours(9, 0, 0, 0);
    return fallback;
  }

  getValidationSummary(): {
    totalValidations: number;
    approvalRate: number;
    commonRejectionReasons: Array<{reason: string; count: number}>;
    averageDelayTime: number;
  } {
    // This would typically come from analytics data
    return {
      totalValidations: 1250,
      approvalRate: 78.4,
      commonRejectionReasons: [
        {reason: 'Quiet hours active', count: 145},
        {reason: 'Category disabled', count: 89},
        {reason: 'Daily limit reached', count: 67},
        {reason: 'Outside recommended hours', count: 45},
      ],
      averageDelayTime: 3.2, // hours
    };
  }
}

export default NotificationValidator.getInstance();