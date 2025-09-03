// packages/core/domain/repositories/ISrsCardRepository.js

/**
 * SRS Card Repository Interface
 * Defines the contract for SRS card data access without implementation details
 */
class ISrsCardRepository {
  /**
   * Find SRS card by ID
   * @param {number} id
   * @returns {Promise<SrsCard|null>}
   */
  async findById(id) {
    throw new Error('Method must be implemented');
  }

  /**
   * Find SRS cards for a user
   * @param {number} userId
   * @param {Object} [filters]
   * @param {string} [filters.itemType] - Type of item (vocab, grammar, etc.)
   * @param {number} [filters.folderId] - Folder filter
   * @param {number} [filters.categoryId] - Category filter
   * @param {boolean} [filters.isDue] - Only due cards
   * @param {boolean} [filters.isOverdue] - Only overdue cards
   * @param {boolean} [filters.isMastered] - Mastered cards filter
   * @returns {Promise<SrsCard[]>}
   */
  async findByUser(userId, filters = {}) {
    throw new Error('Method must be implemented');
  }

  /**
   * Find SRS card by user and item
   * @param {number} userId
   * @param {string} itemType
   * @param {number} itemId
   * @param {number} [folderId] - Optional folder context
   * @returns {Promise<SrsCard|null>}
   */
  async findByUserAndItem(userId, itemType, itemId, folderId = null) {
    throw new Error('Method must be implemented');
  }

  /**
   * Get cards due for review
   * @param {number} userId
   * @param {Date} [beforeDate] - Cards due before this date
   * @param {number} [limit] - Limit number of cards
   * @returns {Promise<SrsCard[]>}
   */
  async findDueForReview(userId, beforeDate = new Date(), limit = null) {
    throw new Error('Method must be implemented');
  }

  /**
   * Get overdue cards
   * @param {number} userId
   * @param {Date} [asOfDate] - Check overdue as of this date
   * @returns {Promise<SrsCard[]>}
   */
  async findOverdueCards(userId, asOfDate = new Date()) {
    throw new Error('Method must be implemented');
  }

  /**
   * Get cards in a specific folder
   * @param {number} folderId
   * @param {Object} [filters]
   * @param {boolean} [filters.includeMastered] - Include mastered cards
   * @returns {Promise<SrsCard[]>}
   */
  async findByFolder(folderId, filters = {}) {
    throw new Error('Method must be implemented');
  }

  /**
   * Get study statistics for user
   * @param {number} userId
   * @param {Date} [fromDate] - Statistics from this date
   * @param {Date} [toDate] - Statistics to this date
   * @returns {Promise<Object>} Statistics object
   */
  async getStudyStats(userId, fromDate = null, toDate = null) {
    throw new Error('Method must be implemented');
  }

  /**
   * Create new SRS card
   * @param {Object} cardData
   * @returns {Promise<SrsCard>}
   */
  async create(cardData) {
    throw new Error('Method must be implemented');
  }

  /**
   * Update SRS card
   * @param {number} id
   * @param {Object} updateData
   * @returns {Promise<SrsCard>}
   */
  async update(id, updateData) {
    throw new Error('Method must be implemented');
  }

  /**
   * Delete SRS card
   * @param {number} id
   * @returns {Promise<boolean>}
   */
  async delete(id) {
    throw new Error('Method must be implemented');
  }

  /**
   * Bulk update multiple cards
   * @param {number[]} ids - Array of card IDs
   * @param {Object} updateData
   * @returns {Promise<number>} Number of updated cards
   */
  async bulkUpdate(ids, updateData) {
    throw new Error('Method must be implemented');
  }

  /**
   * Reset card progress (for admin or user request)
   * @param {number} cardId
   * @returns {Promise<SrsCard>}
   */
  async resetProgress(cardId) {
    throw new Error('Method must be implemented');
  }

  /**
   * Get cards that need daily maintenance (overdue checks, etc.)
   * @returns {Promise<SrsCard[]>}
   */
  async findCardsForMaintenance() {
    throw new Error('Method must be implemented');
  }

  /**
   * Count cards by criteria
   * @param {number} userId
   * @param {Object} criteria
   * @returns {Promise<number>}
   */
  async countByCriteria(userId, criteria) {
    throw new Error('Method must be implemented');
  }

  /**
   * Get learning progress summary for user
   * @param {number} userId
   * @returns {Promise<Object>} Progress summary
   */
  async getProgressSummary(userId) {
    throw new Error('Method must be implemented');
  }

  /**
   * Find cards with specific success rate range
   * @param {number} userId
   * @param {number} minRate - Minimum success rate (0-1)
   * @param {number} maxRate - Maximum success rate (0-1)
   * @returns {Promise<SrsCard[]>}
   */
  async findBySuccessRate(userId, minRate, maxRate) {
    throw new Error('Method must be implemented');
  }
}

module.exports = ISrsCardRepository;