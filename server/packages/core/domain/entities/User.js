// packages/core/domain/entities/User.js
const dayjs = require('dayjs');

class User {
  constructor({
    id,
    email,
    passwordHash,
    role = 'USER',
    profile = null,
    createdAt,
    lastStudiedAt = null,
    streak = 0,
    streakUpdatedAt = null,
    dailyQuizCount = 0,
    lastQuizDate = null,
    hasOverdueCards = false,
    lastOverdueCheck = null,
    nextOverdueAlarm = null
  }) {
    this.id = id;
    this.email = email;
    this.passwordHash = passwordHash;
    this.role = role;
    this.profile = profile;
    this.createdAt = createdAt;
    this.lastStudiedAt = lastStudiedAt;
    this.streak = streak;
    this.streakUpdatedAt = streakUpdatedAt;
    this.dailyQuizCount = dailyQuizCount;
    this.lastQuizDate = lastQuizDate;
    this.hasOverdueCards = hasOverdueCards;
    this.lastOverdueCheck = lastOverdueCheck;
    this.nextOverdueAlarm = nextOverdueAlarm;
  }

  // Business rules for user streaks and study habits
  static MAX_DAILY_QUIZ_COUNT = 100;
  static STREAK_GRACE_PERIOD_HOURS = 6; // Allow 6 hours past midnight

  // Core business logic methods
  recordStudySession() {
    const now = new Date();
    const today = dayjs().startOf('day');
    const lastStudied = this.lastStudiedAt ? dayjs(this.lastStudiedAt) : null;
    
    // Update study timestamp
    this.lastStudiedAt = now;
    
    // Update streak logic
    if (!lastStudied || lastStudied.isBefore(today.subtract(1, 'day'))) {
      // First time studying or gap in studying - reset streak
      this.streak = 1;
    } else if (lastStudied.isBefore(today)) {
      // Studied yesterday, continue streak
      this.streak += 1;
    }
    // If studied today already, don't change streak
    
    this.streakUpdatedAt = now;
  }

  recordQuizAttempt() {
    const now = new Date();
    const today = dayjs().startOf('day');
    const lastQuizDay = this.lastQuizDate ? dayjs(this.lastQuizDate).startOf('day') : null;
    
    if (!lastQuizDay || !lastQuizDay.isSame(today)) {
      // First quiz of the day
      this.dailyQuizCount = 1;
    } else {
      // Additional quiz today
      this.dailyQuizCount += 1;
    }
    
    this.lastQuizDate = now;
  }

  canTakeQuiz() {
    return this.dailyQuizCount < User.MAX_DAILY_QUIZ_COUNT;
  }

  updateOverdueStatus(hasOverdue) {
    const now = new Date();
    this.hasOverdueCards = hasOverdue;
    this.lastOverdueCheck = now;
    
    if (hasOverdue && !this.nextOverdueAlarm) {
      // Schedule next overdue alarm in 6 hours
      this.nextOverdueAlarm = dayjs().add(6, 'hours').toDate();
    } else if (!hasOverdue) {
      this.nextOverdueAlarm = null;
    }
  }

  // Query methods
  isStreakAtRisk() {
    if (!this.lastStudiedAt) return true;
    
    const hoursSinceStudy = dayjs().diff(dayjs(this.lastStudiedAt), 'hours');
    const gracePeriod = 24 + User.STREAK_GRACE_PERIOD_HOURS;
    
    return hoursSinceStudy >= gracePeriod;
  }

  getDaysStudied() {
    if (!this.createdAt) return 0;
    return dayjs().diff(dayjs(this.createdAt), 'days');
  }

  getStudyFrequency() {
    const daysStudied = this.getDaysStudied();
    if (daysStudied === 0) return 0;
    
    // Simple frequency calculation (could be more sophisticated)
    return this.streak / daysStudied;
  }

  // Business rule: User level assessment
  getUserLevel() {
    if (this.streak >= 365) return 'master';
    if (this.streak >= 100) return 'advanced';
    if (this.streak >= 30) return 'intermediate';
    if (this.streak >= 7) return 'beginner';
    return 'newcomer';
  }

  isAdmin() {
    return this.role === 'ADMIN';
  }

  canAccessAdminFeatures() {
    return this.isAdmin();
  }

  // Profile management
  updateProfile(profileData) {
    const allowedFields = ['name', 'timezone', 'preferredLanguage', 'dailyGoal'];
    const updatedProfile = { ...this.profile };
    
    Object.keys(profileData).forEach(key => {
      if (allowedFields.includes(key)) {
        updatedProfile[key] = profileData[key];
      }
    });
    
    this.profile = updatedProfile;
  }

  getPreferredTimezone() {
    return this.profile?.timezone || 'Asia/Seoul';
  }

  getDailyGoal() {
    return this.profile?.dailyGoal || 10; // Default 10 cards per day
  }

  toString() {
    return `User[${this.email}] Streak:${this.streak} Level:${this.getUserLevel()}`;
  }
}

module.exports = User;