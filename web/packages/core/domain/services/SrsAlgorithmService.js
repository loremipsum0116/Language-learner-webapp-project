// packages/core/domain/services/SrsAlgorithmService.js
const dayjs = require('dayjs');

/**
 * SRS Algorithm Domain Service
 * Contains complex business logic for spaced repetition system
 */
class SrsAlgorithmService {
  constructor() {
    // SRS algorithm constants
    this.STAGE_INTERVALS = [1, 3, 7, 21, 60, 180]; // days
    this.DIFFICULTY_MULTIPLIERS = {
      easy: 1.3,
      medium: 1.0,
      hard: 0.8
    };
    this.MASTERY_THRESHOLD = 0.85; // 85% success rate
    this.MASTERY_REQUIRED_CYCLES = 3;
    this.OVERDUE_PENALTY_MULTIPLIER = 0.7;
  }

  /**
   * Calculate next review date based on card performance
   * @param {SrsCard} card
   * @param {string} difficulty - 'easy', 'medium', 'hard'
   * @param {boolean} isCorrect
   * @returns {Date}
   */
  calculateNextReview(card, difficulty, isCorrect) {
    let newStage = card.stage;
    
    if (isCorrect) {
      // Advance stage with difficulty consideration
      if (difficulty === 'easy' && card.stage < this.STAGE_INTERVALS.length - 1) {
        newStage = Math.min(card.stage + 2, this.STAGE_INTERVALS.length - 1);
      } else if (card.stage < this.STAGE_INTERVALS.length - 1) {
        newStage = card.stage + 1;
      }
    } else {
      // Wrong answer - reduce stage based on difficulty and streak
      const penalty = card.wrongStreakCount >= 3 ? 2 : 1;
      newStage = Math.max(0, card.stage - penalty);
    }

    // Get base interval
    let intervalDays = this.STAGE_INTERVALS[newStage];
    
    // Apply difficulty multiplier
    const multiplier = this.DIFFICULTY_MULTIPLIERS[difficulty] || 1.0;
    intervalDays = Math.round(intervalDays * multiplier);
    
    // Apply overdue penalty if applicable
    if (card.isOverdue) {
      intervalDays = Math.round(intervalDays * this.OVERDUE_PENALTY_MULTIPLIER);
    }

    return dayjs().add(intervalDays, 'days').toDate();
  }

  /**
   * Determine if card should advance to mastery
   * @param {SrsCard} card
   * @returns {boolean}
   */
  shouldAdvanceToMastery(card) {
    // Must be at max stage
    if (card.stage < this.STAGE_INTERVALS.length - 1) {
      return false;
    }

    // Must have good success rate
    const successRate = card.getSuccessRate();
    if (successRate < this.MASTERY_THRESHOLD) {
      return false;
    }

    // Must have sufficient attempts
    const totalAttempts = card.correctTotal + card.wrongTotal;
    if (totalAttempts < 5) {
      return false;
    }

    return true;
  }

  /**
   * Calculate optimal batch size for study session
   * @param {SrsCard[]} dueCards
   * @param {Object} userPreferences
   * @returns {number}
   */
  calculateOptimalBatchSize(dueCards, userPreferences = {}) {
    const { dailyGoal = 20, availableTime = 30, difficulty = 'medium' } = userPreferences;
    
    // Base calculations
    const timePerCard = difficulty === 'hard' ? 3 : difficulty === 'easy' ? 1.5 : 2; // minutes
    const maxCardsByTime = Math.floor(availableTime / timePerCard);
    
    // Factor in overdue cards (prioritize them)
    const overdueCards = dueCards.filter(card => card.isOverdue);
    const overdueCount = Math.min(overdueCards.length, Math.ceil(dailyGoal * 0.7));
    
    // Calculate final batch size
    const batchSize = Math.min(
      dailyGoal,
      maxCardsByTime,
      dueCards.length,
      Math.max(overdueCount, Math.ceil(dailyGoal * 0.5)) // At least 50% of daily goal
    );

    return Math.max(1, batchSize);
  }

  /**
   * Prioritize cards for review session
   * @param {SrsCard[]} cards
   * @returns {SrsCard[]}
   */
  prioritizeCardsForReview(cards) {
    return cards.sort((a, b) => {
      // 1. Overdue cards first
      if (a.isOverdue !== b.isOverdue) {
        return b.isOverdue - a.isOverdue;
      }

      // 2. Cards with wrong streaks
      if (a.wrongStreakCount !== b.wrongStreakCount) {
        return b.wrongStreakCount - a.wrongStreakCount;
      }

      // 3. Due date (most overdue first)
      if (a.nextReviewAt && b.nextReviewAt) {
        return new Date(a.nextReviewAt) - new Date(b.nextReviewAt);
      }

      // 4. Lower stage cards (need more practice)
      if (a.stage !== b.stage) {
        return a.stage - b.stage;
      }

      // 5. Lower success rate
      return a.getSuccessRate() - b.getSuccessRate();
    });
  }

  /**
   * Calculate user's learning velocity
   * @param {Object} studyStats - Recent study statistics
   * @returns {Object} Velocity metrics
   */
  calculateLearningVelocity(studyStats) {
    const {
      cardsReviewedLast7Days = 0,
      cardsReviewedLast30Days = 0,
      averageSuccessRate = 0,
      averageTimePerCard = 0
    } = studyStats;

    const dailyVelocity = cardsReviewedLast7Days / 7;
    const weeklyTrend = cardsReviewedLast7Days / (cardsReviewedLast30Days / 4);
    
    // Efficiency score (cards per minute * success rate)
    const efficiency = averageTimePerCard > 0 
      ? (1 / averageTimePerCard) * averageSuccessRate 
      : 0;

    return {
      dailyVelocity: Math.round(dailyVelocity * 10) / 10,
      weeklyTrend: Math.round(weeklyTrend * 100) / 100,
      efficiency: Math.round(efficiency * 1000) / 1000,
      recommendation: this.getVelocityRecommendation(dailyVelocity, weeklyTrend, efficiency)
    };
  }

  /**
   * Get recommendation based on learning velocity
   * @private
   */
  getVelocityRecommendation(dailyVelocity, weeklyTrend, efficiency) {
    if (dailyVelocity < 5) {
      return 'Consider increasing daily study time to build momentum';
    }
    
    if (weeklyTrend < 0.8) {
      return 'Your study pace is declining. Try shorter, more frequent sessions';
    }
    
    if (efficiency < 0.1) {
      return 'Focus on accuracy over speed. Take time to understand each card';
    }
    
    if (dailyVelocity > 50) {
      return 'Great pace! Consider adding new material to your study set';
    }
    
    return 'Good steady progress. Keep up the consistent study routine';
  }

  /**
   * Determine if card needs urgent review
   * @param {SrsCard} card
   * @returns {boolean}
   */
  isUrgentReview(card) {
    if (!card.nextReviewAt) return false;
    
    const daysPastDue = dayjs().diff(dayjs(card.nextReviewAt), 'days');
    const urgencyThreshold = this.STAGE_INTERVALS[card.stage] * 0.5; // 50% of interval
    
    return daysPastDue >= urgencyThreshold;
  }

  /**
   * Calculate retention forecast
   * @param {SrsCard} card
   * @param {number} daysInFuture
   * @returns {number} Predicted retention probability (0-1)
   */
  predictRetention(card, daysInFuture) {
    const successRate = card.getSuccessRate();
    const daysSinceLastReview = card.getDaysSinceLastReview() || 0;
    const totalReviews = card.correctTotal + card.wrongTotal;
    
    // Simple exponential decay model
    const stability = Math.log(successRate + 0.1) * Math.sqrt(totalReviews);
    const decay = Math.exp(-daysInFuture / (stability * 10));
    
    return Math.max(0.1, Math.min(0.95, decay));
  }
}

module.exports = SrsAlgorithmService;