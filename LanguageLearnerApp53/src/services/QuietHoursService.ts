import AsyncStorage from '@react-native-async-storage/async-storage';

const QUIET_HOURS_KEY = '@quiet_hours_settings';

export interface QuietHoursSettings {
  enabled: boolean;
  schedules: QuietHoursSchedule[];
  emergencyBypass: boolean;
  allowCriticalNotifications: boolean;
}

export interface QuietHoursSchedule {
  id: string;
  name: string;
  startTime: string; // HH:mm format
  endTime: string; // HH:mm format
  daysOfWeek: number[]; // 0-6 (Sunday-Saturday)
  enabled: boolean;
  allowedCategories: string[]; // Categories that can still send notifications
}

export class QuietHoursService {
  private static instance: QuietHoursService;
  private settings: QuietHoursSettings = {
    enabled: false,
    schedules: [],
    emergencyBypass: false,
    allowCriticalNotifications: true,
  };

  private constructor() {}

  static getInstance(): QuietHoursService {
    if (!QuietHoursService.instance) {
      QuietHoursService.instance = new QuietHoursService();
    }
    return QuietHoursService.instance;
  }

  async initialize(): Promise<void> {
    await this.loadSettings();
    await this.createDefaultSchedules();
  }

  private async createDefaultSchedules(): Promise<void> {
    if (this.settings.schedules.length === 0) {
      const defaultSchedules: QuietHoursSchedule[] = [
        {
          id: 'sleep-time',
          name: 'Sleep Hours',
          startTime: '22:00',
          endTime: '07:00',
          daysOfWeek: [0, 1, 2, 3, 4, 5, 6], // All days
          enabled: true,
          allowedCategories: ['emergency'], // Only emergency notifications
        },
        {
          id: 'work-focus',
          name: 'Work Focus',
          startTime: '09:00',
          endTime: '17:00',
          daysOfWeek: [1, 2, 3, 4, 5], // Weekdays only
          enabled: false,
          allowedCategories: ['srs_review', 'goal_achieved'], // Only important learning notifications
        },
        {
          id: 'study-time',
          name: 'Deep Study',
          startTime: '14:00',
          endTime: '16:00',
          daysOfWeek: [1, 2, 3, 4, 5], // Weekdays only
          enabled: false,
          allowedCategories: [], // No notifications during deep study
        },
      ];

      this.settings.schedules = defaultSchedules;
      await this.saveSettings();
    }
  }

  isQuietTime(date: Date = new Date()): boolean {
    if (!this.settings.enabled) {
      return false;
    }

    const currentTime = this.formatTime(date);
    const currentDay = date.getDay();

    for (const schedule of this.settings.schedules) {
      if (!schedule.enabled) continue;
      
      if (!schedule.daysOfWeek.includes(currentDay)) continue;

      if (this.isTimeInRange(currentTime, schedule.startTime, schedule.endTime)) {
        return true;
      }
    }

    return false;
  }

  canSendNotification(
    category: string,
    priority: 'low' | 'medium' | 'high' | 'urgent' = 'medium',
    date: Date = new Date()
  ): boolean {
    if (!this.settings.enabled) {
      return true;
    }

    // Always allow urgent notifications with emergency bypass
    if (priority === 'urgent' && this.settings.emergencyBypass) {
      return true;
    }

    // Always allow critical notifications if enabled
    if (this.settings.allowCriticalNotifications && 
        (priority === 'urgent' || category === 'emergency')) {
      return true;
    }

    const currentTime = this.formatTime(date);
    const currentDay = date.getDay();

    for (const schedule of this.settings.schedules) {
      if (!schedule.enabled) continue;
      
      if (!schedule.daysOfWeek.includes(currentDay)) continue;

      if (this.isTimeInRange(currentTime, schedule.startTime, schedule.endTime)) {
        // Check if this category is allowed during quiet hours
        return schedule.allowedCategories.includes(category);
      }
    }

    return true; // Not in any quiet hours period
  }

  private isTimeInRange(currentTime: string, startTime: string, endTime: string): boolean {
    const current = this.timeToMinutes(currentTime);
    const start = this.timeToMinutes(startTime);
    const end = this.timeToMinutes(endTime);

    // Handle overnight periods (e.g., 22:00 - 07:00)
    if (start > end) {
      return current >= start || current <= end;
    } else {
      return current >= start && current <= end;
    }
  }

  private timeToMinutes(time: string): number {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
  }

  private formatTime(date: Date): string {
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  }

  async updateSettings(settings: Partial<QuietHoursSettings>): Promise<void> {
    this.settings = { ...this.settings, ...settings };
    await this.saveSettings();
  }

  async addSchedule(schedule: Omit<QuietHoursSchedule, 'id'>): Promise<void> {
    const newSchedule: QuietHoursSchedule = {
      ...schedule,
      id: `schedule_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    };

    this.settings.schedules.push(newSchedule);
    await this.saveSettings();
  }

  async updateSchedule(
    scheduleId: string,
    updates: Partial<QuietHoursSchedule>
  ): Promise<void> {
    const scheduleIndex = this.settings.schedules.findIndex(
      s => s.id === scheduleId
    );

    if (scheduleIndex !== -1) {
      this.settings.schedules[scheduleIndex] = {
        ...this.settings.schedules[scheduleIndex],
        ...updates,
      };
      await this.saveSettings();
    }
  }

  async deleteSchedule(scheduleId: string): Promise<void> {
    this.settings.schedules = this.settings.schedules.filter(
      s => s.id !== scheduleId
    );
    await this.saveSettings();
  }

  getActiveQuietSchedules(date: Date = new Date()): QuietHoursSchedule[] {
    if (!this.settings.enabled) {
      return [];
    }

    const currentTime = this.formatTime(date);
    const currentDay = date.getDay();
    const activeSchedules: QuietHoursSchedule[] = [];

    for (const schedule of this.settings.schedules) {
      if (!schedule.enabled) continue;
      
      if (!schedule.daysOfWeek.includes(currentDay)) continue;

      if (this.isTimeInRange(currentTime, schedule.startTime, schedule.endTime)) {
        activeSchedules.push(schedule);
      }
    }

    return activeSchedules;
  }

  getNextQuietPeriod(date: Date = new Date()): {
    schedule: QuietHoursSchedule;
    startTime: Date;
  } | null {
    if (!this.settings.enabled) {
      return null;
    }

    let nextStart: Date | null = null;
    let nextSchedule: QuietHoursSchedule | null = null;

    for (const schedule of this.settings.schedules) {
      if (!schedule.enabled) continue;

      // Find next occurrence of this schedule
      const nextOccurrence = this.getNextScheduleOccurrence(schedule, date);
      
      if (nextOccurrence && (!nextStart || nextOccurrence < nextStart)) {
        nextStart = nextOccurrence;
        nextSchedule = schedule;
      }
    }

    return nextSchedule && nextStart 
      ? { schedule: nextSchedule, startTime: nextStart }
      : null;
  }

  private getNextScheduleOccurrence(
    schedule: QuietHoursSchedule,
    fromDate: Date
  ): Date | null {
    const currentDay = fromDate.getDay();
    const currentTime = this.formatTime(fromDate);
    
    // Check if schedule can start today
    if (schedule.daysOfWeek.includes(currentDay)) {
      if (currentTime < schedule.startTime) {
        // Schedule starts later today
        const nextStart = new Date(fromDate);
        const [hours, minutes] = schedule.startTime.split(':').map(Number);
        nextStart.setHours(hours, minutes, 0, 0);
        return nextStart;
      }
    }

    // Find next day this schedule is active
    for (let i = 1; i <= 7; i++) {
      const checkDate = new Date(fromDate);
      checkDate.setDate(checkDate.getDate() + i);
      const checkDay = checkDate.getDay();

      if (schedule.daysOfWeek.includes(checkDay)) {
        const [hours, minutes] = schedule.startTime.split(':').map(Number);
        checkDate.setHours(hours, minutes, 0, 0);
        return checkDate;
      }
    }

    return null;
  }

  async enableQuietMode(duration: number): Promise<void> {
    // Temporarily enable quiet mode for specified duration (in minutes)
    const endTime = new Date();
    endTime.setMinutes(endTime.getMinutes() + duration);

    const temporarySchedule: QuietHoursSchedule = {
      id: `temp_${Date.now()}`,
      name: `Temporary Quiet (${duration}min)`,
      startTime: this.formatTime(new Date()),
      endTime: this.formatTime(endTime),
      daysOfWeek: [new Date().getDay()],
      enabled: true,
      allowedCategories: ['emergency'],
    };

    this.settings.schedules.push(temporarySchedule);
    this.settings.enabled = true;
    await this.saveSettings();

    // Schedule cleanup
    setTimeout(async () => {
      await this.deleteSchedule(temporarySchedule.id);
    }, duration * 60 * 1000);
  }

  getQuietHoursStatus(): {
    isActive: boolean;
    activeSchedules: QuietHoursSchedule[];
    nextQuietPeriod: { schedule: QuietHoursSchedule; startTime: Date } | null;
    blockedCategories: string[];
  } {
    const activeSchedules = this.getActiveQuietSchedules();
    const nextQuietPeriod = this.getNextQuietPeriod();
    
    // Get all blocked categories from active schedules
    const allowedCategories = new Set<string>();
    activeSchedules.forEach(schedule => {
      schedule.allowedCategories.forEach(category => {
        allowedCategories.add(category);
      });
    });

    const allCategories = [
      'learning_reminder',
      'streak_reminder', 
      'srs_review',
      'goal_achieved',
      'milestone_reached',
      'new_content',
      'weekly_progress',
      'encouragement'
    ];

    const blockedCategories = allCategories.filter(
      category => !allowedCategories.has(category)
    );

    return {
      isActive: activeSchedules.length > 0,
      activeSchedules,
      nextQuietPeriod,
      blockedCategories,
    };
  }

  private async loadSettings(): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem(QUIET_HOURS_KEY);
      if (stored) {
        this.settings = JSON.parse(stored);
      }
    } catch (error) {
      console.error('Error loading quiet hours settings:', error);
    }
  }

  private async saveSettings(): Promise<void> {
    try {
      await AsyncStorage.setItem(QUIET_HOURS_KEY, JSON.stringify(this.settings));
    } catch (error) {
      console.error('Error saving quiet hours settings:', error);
    }
  }

  getSettings(): QuietHoursSettings {
    return { ...this.settings };
  }

  getAllSchedules(): QuietHoursSchedule[] {
    return [...this.settings.schedules];
  }
}

export default QuietHoursService.getInstance();