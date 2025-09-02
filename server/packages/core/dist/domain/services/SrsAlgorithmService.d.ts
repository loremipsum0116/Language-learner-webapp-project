import { SrsCard, SrsReviewResult, SrsAlgorithmConfig, SrsCardStatus, ServiceResponse } from '@shared/types';
/**
 * Advanced SRS (Spaced Repetition System) Algorithm Service
 * Implements sophisticated scheduling algorithm for optimal memory retention
 */
export declare class SrsAlgorithmService {
    private readonly config;
    constructor(config?: Partial<SrsAlgorithmConfig>);
    /**
     * Calculate next review time based on review result
     */
    calculateNextReview(card: SrsCard, result: SrsReviewResult): ServiceResponse<{
        nextDue: Date;
        newLevel: number;
        newStatus: SrsCardStatus;
        interval: number;
    }>;
    /**
     * Calculate level increase based on difficulty
     */
    private calculateLevelIncrease;
    /**
     * Calculate level decrease for incorrect answers
     */
    private calculateLevelDecrease;
    /**
     * Calculate interval based on level and difficulty
     */
    private calculateInterval;
    /**
     * Determine card status based on level and correctness
     */
    private determineCardStatus;
    /**
     * Get cards due for review
     */
    getCardsForReview(cards: SrsCard[], limit?: number): SrsCard[];
    /**
     * Calculate retention rate for a set of cards
     */
    calculateRetentionRate(cards: SrsCard[]): number;
    /**
     * Get study statistics
     */
    getStudyStats(cards: SrsCard[]): {
        total: number;
        available: number;
        waiting: number;
        mastered: number;
        failed: number;
        averageLevel: number;
        retentionRate: number;
        totalStudyTime: number;
        averageResponseTime: number;
    };
    /**
     * Predict optimal study session size
     */
    recommendStudySessionSize(availableCards: number, userLevel?: 'beginner' | 'intermediate' | 'advanced', availableTimeMinutes?: number): number;
    /**
     * Analyze learning patterns and provide insights
     */
    analyzeLearningPattern(cards: SrsCard[], days?: number): {
        insights: string[];
        recommendations: string[];
        trends: {
            masteryRate: number;
            averageReviews: number;
            difficultCards: SrsCard[];
            strongCards: SrsCard[];
        };
    };
}
//# sourceMappingURL=SrsAlgorithmService.d.ts.map