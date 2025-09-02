"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SrsAlgorithmService = void 0;
const dayjs_1 = __importDefault(require("dayjs"));
/**
 * Advanced SRS (Spaced Repetition System) Algorithm Service
 * Implements sophisticated scheduling algorithm for optimal memory retention
 */
class SrsAlgorithmService {
    constructor(config) {
        this.config = {
            initialInterval: 1, // 1 minute for new cards
            easyFactor: 2.5,
            hardFactor: 1.3,
            maxInterval: 365 * 24 * 60, // 1 year in minutes
            minInterval: 1, // 1 minute
            graduationInterval: 1440, // 24 hours in minutes
            masteryThreshold: 7, // Level 7 = mastered
            ...config
        };
    }
    /**
     * Calculate next review time based on review result
     */
    calculateNextReview(card, result) {
        try {
            const { correct, difficulty = 'medium' } = result;
            const currentLevel = card.level;
            let newLevel;
            let interval;
            if (correct) {
                newLevel = this.calculateLevelIncrease(currentLevel, difficulty);
                interval = this.calculateInterval(newLevel, difficulty);
            }
            else {
                newLevel = this.calculateLevelDecrease(currentLevel);
                interval = this.config.minInterval;
            }
            // Apply boundaries
            newLevel = Math.max(1, Math.min(newLevel, 10));
            interval = Math.max(this.config.minInterval, Math.min(interval, this.config.maxInterval));
            const nextDue = (0, dayjs_1.default)().add(interval, 'minute').toDate();
            const newStatus = this.determineCardStatus(newLevel, correct);
            return {
                success: true,
                data: {
                    nextDue,
                    newLevel,
                    newStatus,
                    interval
                }
            };
        }
        catch (error) {
            return {
                success: false,
                error: `Failed to calculate next review: ${error instanceof Error ? error.message : 'Unknown error'}`
            };
        }
    }
    /**
     * Calculate level increase based on difficulty
     */
    calculateLevelIncrease(currentLevel, difficulty) {
        switch (difficulty) {
            case 'easy':
                return currentLevel + 2;
            case 'medium':
                return currentLevel + 1;
            case 'hard':
                return currentLevel + 0.5;
            default:
                return currentLevel + 1;
        }
    }
    /**
     * Calculate level decrease for incorrect answers
     */
    calculateLevelDecrease(currentLevel) {
        if (currentLevel <= 1)
            return 1;
        // More aggressive decrease for higher levels
        if (currentLevel >= 5) {
            return Math.max(1, currentLevel - 2);
        }
        else {
            return Math.max(1, currentLevel - 1);
        }
    }
    /**
     * Calculate interval based on level and difficulty
     */
    calculateInterval(level, difficulty) {
        let baseInterval;
        // Define base intervals for each level (in minutes)
        const intervals = [
            1, // Level 1: 1 minute
            5, // Level 2: 5 minutes
            15, // Level 3: 15 minutes
            60, // Level 4: 1 hour
            1440, // Level 5: 24 hours (graduation)
            4320, // Level 6: 3 days
            10080, // Level 7: 1 week
            20160, // Level 8: 2 weeks
            43200, // Level 9: 1 month
            87600 // Level 10: 2 months
        ];
        baseInterval = intervals[Math.min(level - 1, intervals.length - 1)] || this.config.initialInterval;
        // Apply difficulty modifiers
        switch (difficulty) {
            case 'easy':
                return Math.floor(baseInterval * this.config.easyFactor);
            case 'medium':
                return baseInterval;
            case 'hard':
                return Math.floor(baseInterval * this.config.hardFactor);
            default:
                return baseInterval;
        }
    }
    /**
     * Determine card status based on level and correctness
     */
    determineCardStatus(level, correct) {
        if (!correct) {
            return level <= 2 ? 'AVAILABLE' : 'WAITING';
        }
        if (level >= this.config.masteryThreshold) {
            return 'MASTERED';
        }
        if (level >= 5) {
            return 'WAITING';
        }
        return 'AVAILABLE';
    }
    /**
     * Get cards due for review
     */
    getCardsForReview(cards, limit) {
        const now = (0, dayjs_1.default)();
        const dueCards = cards.filter(card => card.status !== 'MASTERED' && (0, dayjs_1.default)(card.nextDue).isBefore(now));
        // Sort by priority: overdue first, then by level (lower first)
        dueCards.sort((a, b) => {
            const aOverdue = now.diff((0, dayjs_1.default)(a.nextDue), 'minute');
            const bOverdue = now.diff((0, dayjs_1.default)(b.nextDue), 'minute');
            if (aOverdue !== bOverdue) {
                return bOverdue - aOverdue; // More overdue first
            }
            return a.level - b.level; // Lower level first
        });
        return limit ? dueCards.slice(0, limit) : dueCards;
    }
    /**
     * Calculate retention rate for a set of cards
     */
    calculateRetentionRate(cards) {
        if (cards.length === 0)
            return 0;
        const totalReviews = cards.reduce((sum, card) => sum + card.studyCount, 0);
        const correctReviews = cards.reduce((sum, card) => sum + card.correctCount, 0);
        return totalReviews > 0 ? (correctReviews / totalReviews) * 100 : 0;
    }
    /**
     * Get study statistics
     */
    getStudyStats(cards) {
        const stats = {
            total: cards.length,
            available: 0,
            waiting: 0,
            mastered: 0,
            failed: 0,
            averageLevel: 0,
            retentionRate: 0,
            totalStudyTime: 0,
            averageResponseTime: 0
        };
        if (cards.length === 0)
            return stats;
        cards.forEach(card => {
            switch (card.status) {
                case 'AVAILABLE':
                    stats.available++;
                    break;
                case 'WAITING':
                    stats.waiting++;
                    break;
                case 'MASTERED':
                    stats.mastered++;
                    break;
                case 'FAILED':
                    stats.failed++;
                    break;
            }
            stats.totalStudyTime += card.totalStudyTime;
        });
        stats.averageLevel = cards.reduce((sum, card) => sum + card.level, 0) / cards.length;
        stats.retentionRate = this.calculateRetentionRate(cards);
        const totalReviews = cards.reduce((sum, card) => sum + card.studyCount, 0);
        const totalResponseTime = cards.reduce((sum, card) => sum + card.totalResponseTime, 0);
        stats.averageResponseTime = totalReviews > 0 ? totalResponseTime / totalReviews : 0;
        return stats;
    }
    /**
     * Predict optimal study session size
     */
    recommendStudySessionSize(availableCards, userLevel = 'intermediate', availableTimeMinutes = 30) {
        const baseRecommendations = {
            beginner: { cardsPerMinute: 0.5, maxCards: 15 },
            intermediate: { cardsPerMinute: 0.75, maxCards: 25 },
            advanced: { cardsPerMinute: 1.0, maxCards: 40 }
        };
        const recommendation = baseRecommendations[userLevel];
        const timeBasedLimit = Math.floor(availableTimeMinutes * recommendation.cardsPerMinute);
        return Math.min(availableCards, timeBasedLimit, recommendation.maxCards);
    }
    /**
     * Analyze learning patterns and provide insights
     */
    analyzeLearningPattern(cards, days = 30) {
        const cutoffDate = (0, dayjs_1.default)().subtract(days, 'day');
        const recentCards = cards.filter(card => (0, dayjs_1.default)(card.lastStudied).isAfter(cutoffDate));
        const insights = [];
        const recommendations = [];
        // Calculate metrics
        const masteryRate = (cards.filter(c => c.status === 'MASTERED').length / cards.length) * 100;
        const averageReviews = cards.reduce((sum, c) => sum + c.studyCount, 0) / cards.length;
        // Identify difficult and strong cards
        const difficultCards = cards
            .filter(c => c.correctCount / Math.max(c.studyCount, 1) < 0.6)
            .sort((a, b) => (a.correctCount / Math.max(a.studyCount, 1)) - (b.correctCount / Math.max(b.studyCount, 1)))
            .slice(0, 10);
        const strongCards = cards
            .filter(c => c.status === 'MASTERED' || (c.correctCount / Math.max(c.studyCount, 1)) > 0.8)
            .slice(0, 10);
        // Generate insights
        if (masteryRate > 80) {
            insights.push("Excellent mastery rate! You're doing great.");
        }
        else if (masteryRate > 60) {
            insights.push("Good progress on vocabulary mastery.");
        }
        else {
            insights.push("There's room for improvement in vocabulary retention.");
            recommendations.push("Consider reviewing difficult words more frequently.");
        }
        if (difficultCards.length > cards.length * 0.3) {
            insights.push("Many cards are showing low retention rates.");
            recommendations.push("Focus on understanding word context and usage.");
        }
        if (averageReviews < 3) {
            recommendations.push("New vocabulary needs more repetition to stick.");
        }
        return {
            insights,
            recommendations,
            trends: {
                masteryRate,
                averageReviews,
                difficultCards,
                strongCards
            }
        };
    }
}
exports.SrsAlgorithmService = SrsAlgorithmService;
//# sourceMappingURL=SrsAlgorithmService.js.map