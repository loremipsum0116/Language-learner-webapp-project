import AsyncStorage from '@react-native-async-storage/async-storage';
import notifee, {AndroidImportance} from '@notifee/react-native';
import {LearningGoal, NotificationType} from '../types/notifications';

const GOALS_KEY = '@learning_goals';
const ACHIEVEMENTS_KEY = '@achievements';
const PROGRESS_KEY = '@learning_progress';

interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  unlockedAt?: Date;
  progress: number;
  target: number;
  category: 'streak' | 'vocabulary' | 'time' | 'lessons' | 'special';
}

interface LearningProgress {
  totalWords: number;
  totalLessons: number;
  totalMinutes: number;
  weeklyWords: number;
  weeklyLessons: number;
  weeklyMinutes: number;
  monthlyWords: number;
  monthlyLessons: number;
  monthlyMinutes: number;
  lastUpdated: Date;
}

export class ProgressNotificationService {
  private static instance: ProgressNotificationService;
  private goals: Map<string, LearningGoal> = new Map();
  private achievements: Map<string, Achievement> = new Map();
  private progress: LearningProgress = {
    totalWords: 0,
    totalLessons: 0,
    totalMinutes: 0,
    weeklyWords: 0,
    weeklyLessons: 0,
    weeklyMinutes: 0,
    monthlyWords: 0,
    monthlyLessons: 0,
    monthlyMinutes: 0,
    lastUpdated: new Date(),
  };

  private constructor() {}

  static getInstance(): ProgressNotificationService {
    if (!ProgressNotificationService.instance) {
      ProgressNotificationService.instance = new ProgressNotificationService();
    }
    return ProgressNotificationService.instance;
  }

  async initialize(): Promise<void> {
    await this.loadGoals();
    await this.loadAchievements();
    await this.loadProgress();
    await this.createNotificationChannel();
    await this.initializeAchievements();
  }

  private async createNotificationChannel(): Promise<void> {
    await notifee.createChannel({
      id: 'progress-updates',
      name: 'Progress Updates',
      importance: AndroidImportance.HIGH,
      sound: 'achievement',
    });
  }

  private async initializeAchievements(): Promise<void> {
    const defaultAchievements: Achievement[] = [
      // Streak Achievements
      {
        id: 'streak_7',
        title: 'Week Warrior',
        description: 'Complete 7 days in a row',
        icon: '🔥',
        progress: 0,
        target: 7,
        category: 'streak',
      },
      {
        id: 'streak_30',
        title: 'Monthly Master',
        description: 'Complete 30 days in a row',
        icon: '💪',
        progress: 0,
        target: 30,
        category: 'streak',
      },
      {
        id: 'streak_100',
        title: 'Century Champion',
        description: 'Complete 100 days in a row',
        icon: '🏆',
        progress: 0,
        target: 100,
        category: 'streak',
      },
      // Vocabulary Achievements
      {
        id: 'vocab_50',
        title: 'Word Collector',
        description: 'Learn 50 new words',
        icon: '📚',
        progress: 0,
        target: 50,
        category: 'vocabulary',
      },
      {
        id: 'vocab_200',
        title: 'Vocabulary Expert',
        description: 'Learn 200 new words',
        icon: '🎓',
        progress: 0,
        target: 200,
        category: 'vocabulary',
      },
      {
        id: 'vocab_1000',
        title: 'Word Master',
        description: 'Learn 1000 new words',
        icon: '👑',
        progress: 0,
        target: 1000,
        category: 'vocabulary',
      },
      // Time Achievements
      {
        id: 'time_10h',
        title: 'Dedicated Learner',
        description: 'Study for 10 hours total',
        icon: '⏰',
        progress: 0,
        target: 600, // minutes
        category: 'time',
      },
      {
        id: 'time_50h',
        title: 'Time Investor',
        description: 'Study for 50 hours total',
        icon: '⌛',
        progress: 0,
        target: 3000, // minutes
        category: 'time',
      },
      // Lesson Achievements
      {
        id: 'lessons_25',
        title: 'Lesson Explorer',
        description: 'Complete 25 lessons',
        icon: '📖',
        progress: 0,
        target: 25,
        category: 'lessons',
      },
      {
        id: 'lessons_100',
        title: 'Lesson Master',
        description: 'Complete 100 lessons',
        icon: '📘',
        progress: 0,
        target: 100,
        category: 'lessons',
      },
    ];

    for (const achievement of defaultAchievements) {
      if (!this.achievements.has(achievement.id)) {
        this.achievements.set(achievement.id, achievement);
      }
    }

    await this.saveAchievements();
  }

  async createGoal(goal: Omit<LearningGoal, 'id' | 'completed'>): Promise<void> {
    const id = `goal_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const newGoal: LearningGoal = {
      ...goal,
      id,
      completed: false,
    };

    this.goals.set(id, newGoal);
    await this.saveGoals();
    await this.sendGoalCreatedNotification(newGoal);
  }

  async updateProgress(update: {
    words?: number;
    lessons?: number;
    minutes?: number;
    streakDays?: number;
  }): Promise<void> {
    const now = new Date();
    
    // Update totals
    if (update.words) {
      this.progress.totalWords += update.words;
      this.progress.weeklyWords += update.words;
      this.progress.monthlyWords += update.words;
    }
    
    if (update.lessons) {
      this.progress.totalLessons += update.lessons;
      this.progress.weeklyLessons += update.lessons;
      this.progress.monthlyLessons += update.lessons;
    }
    
    if (update.minutes) {
      this.progress.totalMinutes += update.minutes;
      this.progress.weeklyMinutes += update.minutes;
      this.progress.monthlyMinutes += update.minutes;
    }

    this.progress.lastUpdated = now;
    await this.saveProgress();

    // Check goals
    await this.checkGoalProgress();
    
    // Check achievements
    await this.checkAchievements(update);
    
    // Send milestone notifications
    await this.checkMilestones();
  }

  private async checkGoalProgress(): Promise<void> {
    const now = new Date();

    for (const goal of this.goals.values()) {
      if (goal.completed || new Date(goal.endDate) < now) continue;

      let currentProgress = 0;
      const timePeriod = this.getTimePeriodProgress(goal.type);

      if (goal.targetWords) {
        currentProgress = (timePeriod.words / goal.targetWords) * 100;
      } else if (goal.targetLessons) {
        currentProgress = (timePeriod.lessons / goal.targetLessons) * 100;
      } else if (goal.targetMinutes) {
        currentProgress = (timePeriod.minutes / goal.targetMinutes) * 100;
      }

      goal.currentProgress = Math.min(100, currentProgress);

      if (goal.currentProgress >= 100 && !goal.completed) {
        goal.completed = true;
        await this.sendGoalCompletedNotification(goal);
      } else if (goal.currentProgress >= 80 && goal.currentProgress < 100) {
        await this.sendGoalNearCompletionNotification(goal);
      }
    }

    await this.saveGoals();
  }

  private getTimePeriodProgress(type: 'daily' | 'weekly' | 'monthly'): {
    words: number;
    lessons: number;
    minutes: number;
  } {
    switch (type) {
      case 'weekly':
        return {
          words: this.progress.weeklyWords,
          lessons: this.progress.weeklyLessons,
          minutes: this.progress.weeklyMinutes,
        };
      case 'monthly':
        return {
          words: this.progress.monthlyWords,
          lessons: this.progress.monthlyLessons,
          minutes: this.progress.monthlyMinutes,
        };
      default: // daily
        // This would need to track daily progress separately
        return {
          words: 0,
          lessons: 0,
          minutes: 0,
        };
    }
  }

  private async checkAchievements(update: {
    words?: number;
    lessons?: number;
    minutes?: number;
    streakDays?: number;
  }): Promise<void> {
    for (const achievement of this.achievements.values()) {
      if (achievement.unlockedAt) continue; // Already unlocked

      let progress = achievement.progress;

      switch (achievement.category) {
        case 'streak':
          if (update.streakDays) {
            progress = update.streakDays;
          }
          break;
        case 'vocabulary':
          progress = this.progress.totalWords;
          break;
        case 'time':
          progress = this.progress.totalMinutes;
          break;
        case 'lessons':
          progress = this.progress.totalLessons;
          break;
      }

      achievement.progress = progress;

      if (progress >= achievement.target && !achievement.unlockedAt) {
        achievement.unlockedAt = new Date();
        await this.sendAchievementUnlockedNotification(achievement);
      }
    }

    await this.saveAchievements();
  }

  private async checkMilestones(): Promise<void> {
    const milestones = [
      {value: 100, type: 'words', message: '100 words learned!'},
      {value: 500, type: 'words', message: '500 words learned!'},
      {value: 1000, type: 'words', message: '1000 words learned!'},
      {value: 50, type: 'lessons', message: '50 lessons completed!'},
      {value: 100, type: 'lessons', message: '100 lessons completed!'},
      {value: 1000, type: 'minutes', message: '1000 minutes of learning!'},
      {value: 5000, type: 'minutes', message: '5000 minutes of learning!'},
    ];

    for (const milestone of milestones) {
      let currentValue = 0;
      
      switch (milestone.type) {
        case 'words':
          currentValue = this.progress.totalWords;
          break;
        case 'lessons':
          currentValue = this.progress.totalLessons;
          break;
        case 'minutes':
          currentValue = this.progress.totalMinutes;
          break;
      }

      if (currentValue === milestone.value) {
        await this.sendMilestoneNotification(milestone.message);
      }
    }
  }

  private async sendGoalCreatedNotification(goal: LearningGoal): Promise<void> {
    const typeText = goal.type.charAt(0).toUpperCase() + goal.type.slice(1);
    let targetText = '';
    
    if (goal.targetWords) targetText = `${goal.targetWords} words`;
    else if (goal.targetLessons) targetText = `${goal.targetLessons} lessons`;
    else if (goal.targetMinutes) targetText = `${goal.targetMinutes} minutes`;

    await notifee.displayNotification({
      id: `goal-created-${goal.id}`,
      title: '🎯 New Goal Set!',
      body: `${typeText} goal: Complete ${targetText}`,
      android: {
        channelId: 'progress-updates',
        importance: AndroidImportance.DEFAULT,
      },
      ios: {
        sound: 'default',
      },
    });
  }

  private async sendGoalCompletedNotification(goal: LearningGoal): Promise<void> {
    await notifee.displayNotification({
      id: `goal-completed-${goal.id}`,
      title: '🎉 Goal Achieved!',
      body: `Congratulations! You've completed your ${goal.type} goal!`,
      android: {
        channelId: 'progress-updates',
        importance: AndroidImportance.HIGH,
        color: '#4CAF50',
      },
      ios: {
        sound: 'achievement',
      },
    });
  }

  private async sendGoalNearCompletionNotification(goal: LearningGoal): Promise<void> {
    await notifee.displayNotification({
      id: `goal-near-${goal.id}`,
      title: '📊 Almost There!',
      body: `You're ${Math.round(goal.currentProgress)}% complete with your ${goal.type} goal!`,
      android: {
        channelId: 'progress-updates',
        importance: AndroidImportance.DEFAULT,
      },
      ios: {
        sound: 'default',
      },
    });
  }

  private async sendAchievementUnlockedNotification(
    achievement: Achievement
  ): Promise<void> {
    await notifee.displayNotification({
      id: `achievement-${achievement.id}`,
      title: `${achievement.icon} Achievement Unlocked!`,
      body: `${achievement.title}: ${achievement.description}`,
      android: {
        channelId: 'progress-updates',
        importance: AndroidImportance.HIGH,
        color: '#FFD700',
        largeIcon: achievement.icon,
      },
      ios: {
        sound: 'achievement',
      },
    });
  }

  private async sendMilestoneNotification(message: string): Promise<void> {
    await notifee.displayNotification({
      id: `milestone-${Date.now()}`,
      title: '🏆 Milestone Reached!',
      body: message,
      android: {
        channelId: 'progress-updates',
        importance: AndroidImportance.HIGH,
        color: '#9C27B0',
      },
      ios: {
        sound: 'achievement',
      },
    });
  }

  async sendWeeklyProgressReport(): Promise<void> {
    const report = this.generateWeeklyReport();
    
    await notifee.displayNotification({
      id: 'weekly-progress',
      title: '📈 Your Weekly Progress',
      body: report,
      android: {
        channelId: 'progress-updates',
        importance: AndroidImportance.DEFAULT,
        style: {
          type: AndroidStyle.BIGTEXT,
          text: report,
        },
      },
      ios: {
        sound: 'default',
      },
    });
  }

  private generateWeeklyReport(): string {
    const lines = [
      `📚 Words learned: ${this.progress.weeklyWords}`,
      `📖 Lessons completed: ${this.progress.weeklyLessons}`,
      `⏱ Study time: ${Math.round(this.progress.weeklyMinutes / 60)} hours`,
    ];

    return lines.join('\n');
  }

  async recommendNewContent(): Promise<void> {
    await notifee.displayNotification({
      id: 'new-content-recommendation',
      title: '✨ New Content Available!',
      body: 'Based on your progress, we have new lessons perfect for your level!',
      android: {
        channelId: 'progress-updates',
        importance: AndroidImportance.DEFAULT,
        pressAction: {
          id: 'view-content',
          launchActivity: 'default',
        },
      },
      ios: {
        sound: 'default',
      },
    });
  }

  private async loadGoals(): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem(GOALS_KEY);
      if (stored) {
        const goals = JSON.parse(stored);
        this.goals = new Map(
          goals.map((goal: LearningGoal) => {
            goal.startDate = new Date(goal.startDate);
            goal.endDate = new Date(goal.endDate);
            return [goal.id, goal];
          })
        );
      }
    } catch (error) {
      console.error('Error loading goals:', error);
    }
  }

  private async saveGoals(): Promise<void> {
    const goals = Array.from(this.goals.values());
    await AsyncStorage.setItem(GOALS_KEY, JSON.stringify(goals));
  }

  private async loadAchievements(): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem(ACHIEVEMENTS_KEY);
      if (stored) {
        const achievements = JSON.parse(stored);
        this.achievements = new Map(
          achievements.map((achievement: Achievement) => {
            if (achievement.unlockedAt) {
              achievement.unlockedAt = new Date(achievement.unlockedAt);
            }
            return [achievement.id, achievement];
          })
        );
      }
    } catch (error) {
      console.error('Error loading achievements:', error);
    }
  }

  private async saveAchievements(): Promise<void> {
    const achievements = Array.from(this.achievements.values());
    await AsyncStorage.setItem(ACHIEVEMENTS_KEY, JSON.stringify(achievements));
  }

  private async loadProgress(): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem(PROGRESS_KEY);
      if (stored) {
        const progress = JSON.parse(stored);
        progress.lastUpdated = new Date(progress.lastUpdated);
        this.progress = progress;
      }
    } catch (error) {
      console.error('Error loading progress:', error);
    }
  }

  private async saveProgress(): Promise<void> {
    await AsyncStorage.setItem(PROGRESS_KEY, JSON.stringify(this.progress));
  }

  getGoals(): LearningGoal[] {
    return Array.from(this.goals.values());
  }

  getAchievements(): Achievement[] {
    return Array.from(this.achievements.values());
  }

  getProgress(): LearningProgress {
    return this.progress;
  }
}

export default ProgressNotificationService.getInstance();