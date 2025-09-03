// packages/core/domain/repositories/IVocabRepository.js

/**
 * Vocab Repository Interface
 * Defines the contract for vocab data access without implementation details
 */
class IVocabRepository {
  /**
   * Find vocabulary by ID
   * @param {number} id
   * @returns {Promise<Vocab|null>}
   */
  async findById(id) {
    throw new Error('Method must be implemented');
  }

  /**
   * Find vocabulary by lemma (word)
   * @param {string} lemma
   * @returns {Promise<Vocab[]>}
   */
  async findByLemma(lemma) {
    throw new Error('Method must be implemented');
  }

  /**
   * Find vocabulary by level with optional filtering
   * @param {Object} criteria
   * @param {string} criteria.level - CEFR level (A1, A2, B1, B2, C1, C2)
   * @param {string} [criteria.pos] - Part of speech filter
   * @param {string} [criteria.source] - Source filter (exclude idioms, etc.)
   * @param {string} [criteria.search] - Search term in lemma
   * @param {number} [criteria.limit] - Limit results
   * @param {number} [criteria.offset] - Offset for pagination
   * @returns {Promise<Vocab[]>}
   */
  async findByLevel(criteria) {
    throw new Error('Method must be implemented');
  }

  /**
   * Find vocabulary by part of speech
   * @param {string} pos - Part of speech
   * @param {Object} [options]
   * @param {string} [options.search] - Search term filter
   * @param {string} [options.source] - Source filter
   * @returns {Promise<Vocab[]>}
   */
  async findByPartOfSpeech(pos, options = {}) {
    throw new Error('Method must be implemented');
  }

  /**
   * Find idioms and phrasal verbs
   * @param {Object} [filters]
   * @param {string} [filters.pos] - Part of speech filter
   * @param {string} [filters.search] - Search term
   * @returns {Promise<Vocab[]>}
   */
  async findIdioms(filters = {}) {
    throw new Error('Method must be implemented');
  }

  /**
   * Search vocabulary with full-text search
   * @param {string} searchTerm
   * @param {Object} [options]
   * @param {number} [options.limit]
   * @param {string[]} [options.levels] - CEFR levels to include
   * @returns {Promise<Vocab[]>}
   */
  async search(searchTerm, options = {}) {
    throw new Error('Method must be implemented');
  }

  /**
   * Get vocabulary count by criteria
   * @param {Object} criteria - Same as findByLevel criteria
   * @returns {Promise<number>}
   */
  async countByCriteria(criteria) {
    throw new Error('Method must be implemented');
  }

  /**
   * Create new vocabulary entry
   * @param {Object} vocabData
   * @returns {Promise<Vocab>}
   */
  async create(vocabData) {
    throw new Error('Method must be implemented');
  }

  /**
   * Update vocabulary entry
   * @param {number} id
   * @param {Object} updateData
   * @returns {Promise<Vocab>}
   */
  async update(id, updateData) {
    throw new Error('Method must be implemented');
  }

  /**
   * Delete vocabulary entry
   * @param {number} id
   * @returns {Promise<boolean>}
   */
  async delete(id) {
    throw new Error('Method must be implemented');
  }

  /**
   * Find vocabulary with dictionary entries included
   * @param {Object} criteria
   * @returns {Promise<Vocab[]>}
   */
  async findWithDictEntries(criteria) {
    throw new Error('Method must be implemented');
  }

  /**
   * Get random vocabulary for practice
   * @param {Object} criteria
   * @param {number} count - Number of random vocabs to return
   * @returns {Promise<Vocab[]>}
   */
  async getRandomVocabs(criteria, count) {
    throw new Error('Method must be implemented');
  }
}

module.exports = IVocabRepository;