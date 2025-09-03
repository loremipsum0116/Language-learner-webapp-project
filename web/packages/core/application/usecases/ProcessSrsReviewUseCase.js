// packages/core/application/usecases/ProcessSrsReviewUseCase.js
const SrsAlgorithmService = require('../../domain/services/SrsAlgorithmService');

/**
 * Process SRS Review Use Case
 * Handles the complex business logic for processing SRS card reviews
 */
class ProcessSrsReviewUseCase {
  constructor(srsCardRepository, vocabRepository, userRepository) {
    this.srsCardRepository = srsCardRepository;
    this.vocabRepository = vocabRepository;
    this.userRepository = userRepository;
    this.srsAlgorithm = new SrsAlgorithmService();
  }

  /**
   * Execute the use case
   * @param {Object} request
   * @param {number} request.userId - User ID
   * @param {number} request.cardId - SRS Card ID
   * @param {boolean} request.isCorrect - Whether answer was correct
   * @param {string} [request.difficulty] - User-assessed difficulty ('easy', 'medium', 'hard')
   * @param {number} [request.responseTime] - Time taken to answer in seconds
   * @param {Object} [request.answerData] - Additional answer data for analytics
   * @returns {Promise<Object>}
   */
  async execute(request) {
    try {
      const {
        userId,
        cardId,
        isCorrect,
        difficulty = 'medium',
        responseTime = null,
        answerData = {}
      } = request;

      // Validate inputs
      this.validateRequest(request);

      // Get the SRS card
      const card = await this.srsCardRepository.findById(cardId);
      if (!card) {
        throw new Error('SRS card not found');
      }

      // Verify card belongs to user
      if (card.userId !== userId) {
        throw new Error('Unauthorized access to SRS card');
      }

      // Prevent duplicate reviews (business rule)
      if (this.isDuplicateReview(card)) {
        throw new Error('Card already reviewed recently');
      }

      // Process the review
      const reviewResult = await this.processReview(card, isCorrect, difficulty, responseTime);

      // Update user statistics
      await this.updateUserStats(userId, isCorrect, responseTime);

      // Record wrong answer if applicable
      if (!isCorrect) {
        await this.recordWrongAnswer(card, answerData);
      }

      return {
        success: true,
        data: {
          cardId: card.id,
          newStage: reviewResult.newStage,
          nextReviewAt: reviewResult.nextReviewAt,
          isMastered: reviewResult.isMastered,
          streakBroken: !isCorrect && card.wrongStreakCount === 0,
          statistics: reviewResult.statistics
        }
      };

    } catch (error) {
      return {
        success: false,
        error: error.message,
        code: this.getErrorCode(error)
      };
    }
  }

  /**
   * Validate request parameters
   * @private
   */
  validateRequest(request) {
    const { userId, cardId, isCorrect, difficulty, responseTime } = request;

    if (!userId || !Number.isInteger(userId)) {
      throw new Error('Valid user ID is required');
    }

    if (!cardId || !Number.isInteger(cardId)) {
      throw new Error('Valid card ID is required');
    }

    if (typeof isCorrect !== 'boolean') {
      throw new Error('isCorrect must be a boolean value');
    }

    if (difficulty && !['easy', 'medium', 'hard'].includes(difficulty)) {
      throw new Error('Difficulty must be easy, medium, or hard');
    }

    if (responseTime !== null && (responseTime < 0 || responseTime > 300)) {
      throw new Error('Response time must be between 0 and 300 seconds');
    }
  }

  /**
   * Check if this is a duplicate review
   * @private
   */
  isDuplicateReview(card) {
    if (!card.lastReviewedAt) return false;
    
    const hoursSinceLastReview = (Date.now() - new Date(card.lastReviewedAt).getTime()) / (1000 * 60 * 60);
    return hoursSinceLastReview < 1; // Prevent reviews within 1 hour
  }

  /**
   * Process the review and update the card
   * @private
   */
  async processReview(card, isCorrect, difficulty, responseTime) {
    const previousStage = card.stage;
    const previousSuccessRate = card.getSuccessRate();

    // Process answer using domain entity methods
    if (isCorrect) {
      card.processCorrectAnswer();
    } else {
      card.processWrongAnswer();
    }

    // Calculate next review using domain service
    const nextReviewAt = this.srsAlgorithm.calculateNextReview(card, difficulty, isCorrect);
    card.nextReviewAt = nextReviewAt;

    // Check for mastery advancement
    if (this.srsAlgorithm.shouldAdvanceToMastery(card)) {
      card.advanceToMastery();
    }

    // Save the updated card
    const updatedCard = await this.srsCardRepository.update(card.id, {
      stage: card.stage,
      nextReviewAt: card.nextReviewAt,
      correctTotal: card.correctTotal,
      wrongTotal: card.wrongTotal,
      wrongStreakCount: card.wrongStreakCount,
      lastReviewedAt: card.lastReviewedAt,
      isTodayStudy: card.isTodayStudy,
      todayFirstResult: card.todayFirstResult,
      todayStudyDate: card.todayStudyDate,
      isMastered: card.isMastered,
      masterCycles: card.masterCycles,
      masteredAt: card.masteredAt
    });

    return {
      newStage: updatedCard.stage,
      nextReviewAt: updatedCard.nextReviewAt,
      isMastered: updatedCard.isMastered,
      statistics: {
        previousStage,
        stageChange: updatedCard.stage - previousStage,
        previousSuccessRate,
        newSuccessRate: updatedCard.getSuccessRate(),
        totalReviews: updatedCard.correctTotal + updatedCard.wrongTotal,
        difficulty: updatedCard.getDifficultyAssessment()
      }
    };
  }

  /**
   * Update user statistics
   * @private
   */
  async updateUserStats(userId, isCorrect, responseTime) {
    // This would typically create/update user study session records
    // For now, we'll just record that the user studied
    const user = await this.userRepository.findById(userId);
    if (user) {
      user.recordStudySession();
      await this.userRepository.update(userId, {
        lastStudiedAt: user.lastStudiedAt,
        streak: user.streak,
        streakUpdatedAt: user.streakUpdatedAt
      });
    }
  }

  /**
   * Record wrong answer for later review
   * @private
   */
  async recordWrongAnswer(card, answerData) {
    // This would typically create a WrongAnswer record
    // Implementation depends on having a WrongAnswerRepository
    console.log(`Recording wrong answer for card ${card.id}`);
    
    // For now, just log. In full implementation, would save to wrong_answers table
    const wrongAnswerData = {
      userId: card.userId,
      itemType: card.itemType,
      itemId: card.itemId,
      folderId: card.folderId,
      wrongAt: new Date(),
      reviewWindowStart: new Date(),
      reviewWindowEnd: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
      wrongData: answerData
    };
  }

  /**
   * Get appropriate error code for different types of errors
   * @private
   */
  getErrorCode(error) {
    if (error.message.includes('not found')) {
      return 'NOT_FOUND';
    }
    if (error.message.includes('Unauthorized')) {
      return 'UNAUTHORIZED';
    }
    if (error.message.includes('duplicate') || error.message.includes('already reviewed')) {
      return 'DUPLICATE_REVIEW';
    }
    if (error.message.includes('Valid') || error.message.includes('must be')) {
      return 'INVALID_INPUT';
    }
    return 'INTERNAL_ERROR';
  }
}

module.exports = ProcessSrsReviewUseCase;