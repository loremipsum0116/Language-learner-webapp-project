import AsyncStorage from '@react-native-async-storage/async-storage';
import {NotificationType, NotificationPriority} from '../types/notifications';

const CATEGORY_SETTINGS_KEY = '@notification_categories';

export interface NotificationCategory {
  id: string;
  name: string;
  description: string;
  icon: string;
  enabled: boolean;
  priority: NotificationPriority;
  sound: string | null;
  vibration: boolean;
  showPreview: boolean;
  frequency: 'immediate' | 'batched' | 'summary';
  batchInterval?: number; // minutes
  types: NotificationType[];
  color: string;
  customSettings?: Record<string, any>;
}

export interface CategorySettings {
  categories: Record<string, NotificationCategory>;
  globalEnabled: boolean;
  doNotDisturbOverride: boolean;
  batchingEnabled: boolean;
  summaryTime: string; // HH:mm format for daily summary
}

export class NotificationCategoryManager {
  private static instance: NotificationCategoryManager;
  private settings: CategorySettings = {
    categories: {},
    globalEnabled: true,
    doNotDisturbOverride: false,
    batchingEnabled: false,
    summaryTime: '18:00',
  };

  private constructor() {}

  static getInstance(): NotificationCategoryManager {
    if (!NotificationCategoryManager.instance) {
      NotificationCategoryManager.instance = new NotificationCategoryManager();
    }
    return NotificationCategoryManager.instance;
  }

  async initialize(): Promise<void> {
    await this.loadSettings();
    await this.initializeDefaultCategories();
  }

  private async initializeDefaultCategories(): Promise<void> {
    const defaultCategories: NotificationCategory[] = [
      {
        id: 'learning_reminders',
        name: 'Learning Reminders',
        description: 'Daily study reminders and encouragement',
        icon: '📚',
        enabled: true,
        priority: NotificationPriority.MEDIUM,
        sound: 'default',
        vibration: true,
        showPreview: true,
        frequency: 'immediate',
        types: [
          NotificationType.LEARNING_REMINDER,
          NotificationType.OPTIMAL_TIME,
          NotificationType.ENCOURAGEMENT,
        ],
        color: '#4CAF50',
        customSettings: {
          maxPerDay: 3,
          respectOptimalTime: true,
        },
      },
      {
        id: 'streak_progress',
        name: 'Streaks & Progress',
        description: 'Streak maintenance and progress updates',
        icon: '🔥',
        enabled: true,
        priority: NotificationPriority.HIGH,
        sound: 'achievement',
        vibration: true,
        showPreview: true,
        frequency: 'immediate',
        types: [
          NotificationType.STREAK_REMINDER,
          NotificationType.WEEKLY_PROGRESS,
        ],
        color: '#FF9800',
        customSettings: {
          streakWarningHours: 20, // Hours before streak break
        },
      },
      {
        id: 'srs_reviews',
        name: 'SRS Reviews',
        description: 'Spaced repetition review notifications',
        icon: '🎯',
        enabled: true,
        priority: NotificationPriority.HIGH,
        sound: 'default',
        vibration: false,
        showPreview: true,
        frequency: 'batched',
        batchInterval: 120, // 2 hours
        types: [NotificationType.SRS_REVIEW],
        color: '#2196F3',
        customSettings: {
          batchSize: 20,
          showCount: true,
        },
      },
      {
        id: 'achievements',
        name: 'Achievements',
        description: 'Goal completions and milestones',
        icon: '🏆',
        enabled: true,
        priority: NotificationPriority.HIGH,
        sound: 'achievement',
        vibration: true,
        showPreview: true,
        frequency: 'immediate',
        types: [
          NotificationType.GOAL_ACHIEVED,
          NotificationType.MILESTONE_REACHED,
        ],
        color: '#FFD700',
      },
      {
        id: 'content_updates',
        name: 'New Content',
        description: 'New lessons and materials available',
        icon: '✨',
        enabled: true,
        priority: NotificationPriority.LOW,
        sound: null,
        vibration: false,
        showPreview: true,
        frequency: 'summary',
        types: [NotificationType.NEW_CONTENT],
        color: '#9C27B0',
        customSettings: {
          maxPerWeek: 3,
          levelBased: true,
        },
      },
    ];

    for (const category of defaultCategories) {
      if (!this.settings.categories[category.id]) {
        this.settings.categories[category.id] = category;
      }
    }

    await this.saveSettings();
  }

  isCategoryEnabled(categoryId: string): boolean {
    const category = this.settings.categories[categoryId];
    return this.settings.globalEnabled && category && category.enabled;
  }

  isNotificationTypeEnabled(type: NotificationType): boolean {
    if (!this.settings.globalEnabled) return false;

    for (const category of Object.values(this.settings.categories)) {
      if (category.types.includes(type)) {
        return category.enabled;
      }
    }

    return false; // Type not found in any category
  }

  getCategoryForType(type: NotificationType): NotificationCategory | null {
    for (const category of Object.values(this.settings.categories)) {
      if (category.types.includes(type)) {
        return category;
      }
    }
    return null;
  }

  async updateCategory(
    categoryId: string,
    updates: Partial<NotificationCategory>
  ): Promise<void> {
    if (this.settings.categories[categoryId]) {
      this.settings.categories[categoryId] = {
        ...this.settings.categories[categoryId],
        ...updates,
      };
      await this.saveSettings();
    }
  }

  async updateGlobalSettings(
    updates: Partial<Omit<CategorySettings, 'categories'>>
  ): Promise<void> {
    this.settings = {
      ...this.settings,
      ...updates,
    };
    await this.saveSettings();
  }

  async enableCategory(categoryId: string): Promise<void> {
    await this.updateCategory(categoryId, {enabled: true});
  }

  async disableCategory(categoryId: string): Promise<void> {
    await this.updateCategory(categoryId, {enabled: false});
  }

  async toggleCategory(categoryId: string): Promise<void> {
    const category = this.settings.categories[categoryId];
    if (category) {
      await this.updateCategory(categoryId, {enabled: !category.enabled});
    }
  }

  getNotificationSettings(type: NotificationType): {
    enabled: boolean;
    category: NotificationCategory | null;
    shouldBatch: boolean;
    priority: NotificationPriority;
    sound: string | null;
    vibration: boolean;
  } {
    const category = this.getCategoryForType(type);
    
    if (!category) {
      return {
        enabled: false,
        category: null,
        shouldBatch: false,
        priority: NotificationPriority.LOW,
        sound: null,
        vibration: false,
      };
    }

    return {
      enabled: this.isCategoryEnabled(category.id),
      category,
      shouldBatch: category.frequency === 'batched',
      priority: category.priority,
      sound: category.sound,
      vibration: category.vibration,
    };
  }

  shouldBatchNotification(type: NotificationType): boolean {
    if (!this.settings.batchingEnabled) return false;
    
    const category = this.getCategoryForType(type);
    return category?.frequency === 'batched';
  }

  getBatchInterval(type: NotificationType): number {
    const category = this.getCategoryForType(type);
    return category?.batchInterval || 60; // Default 1 hour
  }

  getEnabledCategories(): NotificationCategory[] {
    return Object.values(this.settings.categories).filter(
      category => category.enabled
    );
  }

  getDisabledCategories(): NotificationCategory[] {
    return Object.values(this.settings.categories).filter(
      category => !category.enabled
    );
  }

  getCategorySummary(): {
    totalCategories: number;
    enabledCategories: number;
    disabledCategories: number;
    highPriorityEnabled: number;
    batchedCategories: number;
  } {
    const categories = Object.values(this.settings.categories);
    const enabled = categories.filter(c => c.enabled);
    
    return {
      totalCategories: categories.length,
      enabledCategories: enabled.length,
      disabledCategories: categories.length - enabled.length,
      highPriorityEnabled: enabled.filter(
        c => c.priority === NotificationPriority.HIGH || 
            c.priority === NotificationPriority.URGENT
      ).length,
      batchedCategories: enabled.filter(c => c.frequency === 'batched').length,
    };
  }

  async createCustomCategory(
    category: Omit<NotificationCategory, 'id'>
  ): Promise<string> {
    const id = `custom_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const newCategory: NotificationCategory = {
      ...category,
      id,
    };

    this.settings.categories[id] = newCategory;
    await this.saveSettings();
    
    return id;
  }

  async deleteCustomCategory(categoryId: string): Promise<boolean> {
    if (categoryId.startsWith('custom_') && this.settings.categories[categoryId]) {
      delete this.settings.categories[categoryId];
      await this.saveSettings();
      return true;
    }
    return false; // Cannot delete default categories
  }

  async resetToDefaults(): Promise<void> {
    this.settings.categories = {};
    await this.initializeDefaultCategories();
  }

  exportSettings(): string {
    return JSON.stringify(this.settings, null, 2);
  }

  async importSettings(settingsJson: string): Promise<boolean> {
    try {
      const importedSettings = JSON.parse(settingsJson);
      
      // Validate structure
      if (importedSettings.categories && 
          typeof importedSettings.globalEnabled === 'boolean') {
        this.settings = importedSettings;
        await this.saveSettings();
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Error importing settings:', error);
      return false;
    }
  }

  getQuickActions(): Array<{
    id: string;
    title: string;
    description: string;
    action: () => Promise<void>;
    icon: string;
  }> {
    return [
      {
        id: 'disable_all',
        title: 'Disable All Notifications',
        description: 'Turn off all notification categories',
        icon: '🔕',
        action: async () => {
          await this.updateGlobalSettings({globalEnabled: false});
        },
      },
      {
        id: 'essential_only',
        title: 'Essential Only',
        description: 'Keep only high-priority notifications',
        icon: '⚡',
        action: async () => {
          for (const [id, category] of Object.entries(this.settings.categories)) {
            const enabled = category.priority === NotificationPriority.HIGH ||
                          category.priority === NotificationPriority.URGENT;
            await this.updateCategory(id, {enabled});
          }
        },
      },
      {
        id: 'enable_batching',
        title: 'Enable Smart Batching',
        description: 'Group similar notifications together',
        icon: '📦',
        action: async () => {
          await this.updateGlobalSettings({batchingEnabled: true});
        },
      },
      {
        id: 'study_mode',
        title: 'Study Mode',
        description: 'Only learning and review notifications',
        icon: '📖',
        action: async () => {
          for (const [id, category] of Object.entries(this.settings.categories)) {
            const enabled = ['learning_reminders', 'srs_reviews'].includes(id);
            await this.updateCategory(id, {enabled});
          }
        },
      },
    ];
  }

  private async loadSettings(): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem(CATEGORY_SETTINGS_KEY);
      if (stored) {
        this.settings = JSON.parse(stored);
      }
    } catch (error) {
      console.error('Error loading category settings:', error);
    }
  }

  private async saveSettings(): Promise<void> {
    try {
      await AsyncStorage.setItem(
        CATEGORY_SETTINGS_KEY,
        JSON.stringify(this.settings)
      );
    } catch (error) {
      console.error('Error saving category settings:', error);
    }
  }

  getSettings(): CategorySettings {
    return {...this.settings};
  }

  getAllCategories(): NotificationCategory[] {
    return Object.values(this.settings.categories);
  }

  getCategory(categoryId: string): NotificationCategory | null {
    return this.settings.categories[categoryId] || null;
  }
}

export default NotificationCategoryManager.getInstance();