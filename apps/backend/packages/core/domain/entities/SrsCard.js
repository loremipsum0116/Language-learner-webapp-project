// packages/core/domain/entities/SrsCard.js
const dayjs = require('dayjs');

class SrsCard {
  constructor({
    id,
    userId,
    itemType,
    itemId,
    stage = 0,
    nextReviewAt = null,
    categoryId = null,
    correctTotal = 0,
    wrongTotal = 0,
    cohortDate = null,
    isOverdue = false,
    overdueDeadline = null,
    isFromWrongAnswer = false,
    waitingUntil = null,
    frozenUntil = null,
    folderId = null,
    isMastered = false,
    masterCycles = 0,
    masteredAt = null,
    overdueStartAt = null,
    wrongStreakCount = 0,
    lastReviewedAt = null,
    isTodayStudy = false,
    todayFirstResult = null,
    todayStudyDate = null
  }) {
    this.id = id;
    this.userId = userId;
    this.itemType = itemType;
    this.itemId = itemId;
    this.stage = stage;
    this.nextReviewAt = nextReviewAt;
    this.categoryId = categoryId;
    this.correctTotal = correctTotal;
    this.wrongTotal = wrongTotal;
    this.cohortDate = cohortDate;
    this.isOverdue = isOverdue;
    this.overdueDeadline = overdueDeadline;
    this.isFromWrongAnswer = isFromWrongAnswer;
    this.waitingUntil = waitingUntil;
    this.frozenUntil = frozenUntil;
    this.folderId = folderId;
    this.isMastered = isMastered;
    this.masterCycles = masterCycles;
    this.masteredAt = masteredAt;
    this.overdueStartAt = overdueStartAt;
    this.wrongStreakCount = wrongStreakCount;
    this.lastReviewedAt = lastReviewedAt;
    this.isTodayStudy = isTodayStudy;
    this.todayFirstResult = todayFirstResult;
    this.todayStudyDate = todayStudyDate;
  }

  // Business rules for SRS algorithm
  static STAGE_INTERVALS = [
    1,    // Stage 0: 1 day
    3,    // Stage 1: 3 days  
    7,    // Stage 2: 1 week
    21,   // Stage 3: 3 weeks
    60,   // Stage 4: 2 months
    180   // Stage 5: 6 months
  ];

  static MAX_STAGE = SrsCard.STAGE_INTERVALS.length - 1;
  static MASTERY_REQUIRED_CYCLES = 3;
  static WRONG_STREAK_THRESHOLD = 3;

  // Core business logic methods
  processCorrectAnswer() {
    this.correctTotal += 1;
    this.wrongStreakCount = 0;
    this.lastReviewedAt = new Date();
    
    if (!this.isTodayStudy) {
      this.isTodayStudy = true;
      this.todayFirstResult = true;
      this.todayStudyDate = dayjs().startOf('day').toDate();
    }

    if (this.stage < SrsCard.MAX_STAGE) {
      this.stage += 1;
      this.scheduleNextReview();
    } else {
      this.advanceToMastery();
    }
  }

  processWrongAnswer() {
    this.wrongTotal += 1;
    this.wrongStreakCount += 1;
    this.lastReviewedAt = new Date();
    
    if (!this.isTodayStudy) {
      this.isTodayStudy = true;
      this.todayFirstResult = false;
      this.todayStudyDate = dayjs().startOf('day').toDate();
    }

    // Reset to lower stage based on business rules
    if (this.wrongStreakCount >= SrsCard.WRONG_STREAK_THRESHOLD) {
      this.stage = Math.max(0, this.stage - 2);
    } else {
      this.stage = Math.max(0, this.stage - 1);
    }
    
    this.scheduleNextReview();
  }

  scheduleNextReview() {
    const interval = SrsCard.STAGE_INTERVALS[this.stage];
    this.nextReviewAt = dayjs().add(interval, 'day').toDate();
    this.isOverdue = false;
    this.overdueDeadline = null;
  }

  advanceToMastery() {
    this.masterCycles += 1;
    
    if (this.masterCycles >= SrsCard.MASTERY_REQUIRED_CYCLES) {
      this.isMastered = true;
      this.masteredAt = new Date();
      this.nextReviewAt = null; // No more reviews needed
    } else {
      // Still need more cycles, schedule far in future
      this.nextReviewAt = dayjs().add(6, 'months').toDate();
    }
  }

  // Query methods
  isDueForReview(now = new Date()) {
    if (this.isMastered || this.frozenUntil > now || this.waitingUntil > now) {
      return false;
    }
    return this.nextReviewAt <= now;
  }

  isOverdueForReview(now = new Date()) {
    if (!this.isDueForReview(now)) return false;
    
    const daysSinceReview = dayjs(now).diff(dayjs(this.nextReviewAt), 'days');
    return daysSinceReview >= 1; // Overdue after 1 day
  }

  getSuccessRate() {
    const totalAttempts = this.correctTotal + this.wrongTotal;
    return totalAttempts === 0 ? 0 : this.correctTotal / totalAttempts;
  }

  getDaysSinceLastReview(now = new Date()) {
    if (!this.lastReviewedAt) return null;
    return dayjs(now).diff(dayjs(this.lastReviewedAt), 'days');
  }

  // Business rule: Card difficulty assessment
  getDifficultyAssessment() {
    const successRate = this.getSuccessRate();
    const wrongStreak = this.wrongStreakCount;
    
    if (successRate >= 0.8 && wrongStreak === 0) return 'easy';
    if (successRate >= 0.6 && wrongStreak <= 1) return 'medium';
    return 'hard';
  }

  toString() {
    return `SrsCard[${this.itemType}:${this.itemId}] Stage:${this.stage} Success:${this.getSuccessRate().toFixed(2)}`;
  }
}

module.exports = SrsCard;