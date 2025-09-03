// packages/core/application/usecases/GetVocabularyListUseCase.js
const Vocab = require('../../domain/entities/Vocab');

/**
 * Get Vocabulary List Use Case
 * Handles business logic for retrieving vocabulary lists with various filtering options
 */
class GetVocabularyListUseCase {
  constructor(vocabRepository) {
    this.vocabRepository = vocabRepository;
  }

  /**
   * Execute the use case
   * @param {Object} request
   * @param {string} [request.level] - CEFR level (A1, A2, etc.)
   * @param {string} [request.search] - Search term
   * @param {string} [request.pos] - Part of speech filter
   * @param {boolean} [request.includeIdioms] - Include idioms and phrasal verbs
   * @param {number} [request.limit] - Limit results
   * @param {number} [request.offset] - Offset for pagination
   * @returns {Promise<Object>}
   */
  async execute(request) {
    try {
      const {
        level,
        search,
        pos,
        includeIdioms = false,
        limit = 100,
        offset = 0
      } = request;

      // Validate inputs
      this.validateRequest(request);

      // Build search criteria
      const criteria = this.buildSearchCriteria({
        level,
        search,
        pos,
        includeIdioms,
        limit,
        offset
      });

      // Execute search
      const vocabs = await this.vocabRepository.findWithDictEntries(criteria);
      const totalCount = await this.vocabRepository.countByCriteria(criteria);

      // Transform to response format
      const transformedVocabs = vocabs.map(vocab => this.transformVocabForResponse(vocab));

      return {
        success: true,
        data: {
          vocabs: transformedVocabs,
          pagination: {
            total: totalCount,
            limit,
            offset,
            hasMore: offset + limit < totalCount
          },
          filters: {
            level,
            search,
            pos,
            includeIdioms
          }
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
    const { level, limit, offset } = request;
    
    if (level && !['A1', 'A2', 'B1', 'B2', 'C1', 'C2'].includes(level)) {
      throw new Error('Invalid CEFR level. Must be A1, A2, B1, B2, C1, or C2');
    }

    if (limit && (limit < 1 || limit > 500)) {
      throw new Error('Limit must be between 1 and 500');
    }

    if (offset && offset < 0) {
      throw new Error('Offset must be non-negative');
    }
  }

  /**
   * Build search criteria for repository
   * @private
   */
  buildSearchCriteria({ level, search, pos, includeIdioms, limit, offset }) {
    const criteria = {
      limit,
      offset
    };

    // Handle search vs level-based filtering
    if (search && search.trim()) {
      criteria.search = search.trim();
    } else if (level) {
      criteria.level = level;
      
      // Exclude idioms from level-based vocabulary unless explicitly included
      if (!includeIdioms) {
        criteria.excludeSources = ['idiom', 'idiom_migration'];
      }
    }

    if (pos) {
      criteria.pos = pos;
    }

    return criteria;
  }

  /**
   * Transform vocab entity for API response
   * @private
   */
  transformVocabForResponse(vocab) {
    const transformed = {
      id: vocab.id,
      lemma: vocab.lemma,
      pos: vocab.pos,
      level: vocab.levelCEFR,
      frequency: vocab.frequency,
      source: vocab.source,
      isIdiom: vocab.isIdiom(),
      isPhrasalVerb: vocab.isPhrasalVerb()
    };

    // Add dictionary information if available
    if (vocab.dictEntry) {
      transformed.dictionary = {
        ipa: vocab.dictEntry.ipa,
        ipaKo: vocab.dictEntry.ipaKo,
        hasAudio: vocab.hasAudio(),
        definition: vocab.getDefinition('ko'),
        example: vocab.getExampleSentence('en'),
        exampleKo: vocab.getExampleSentence('ko')
      };

      // Add audio information
      if (vocab.hasAudio()) {
        try {
          const audioData = vocab.dictEntry.audioLocal 
            ? JSON.parse(vocab.dictEntry.audioLocal) 
            : null;
          transformed.dictionary.audio = audioData;
        } catch (e) {
          // Ignore JSON parse errors
        }
      }
    }

    return transformed;
  }

  /**
   * Get appropriate error code for different types of errors
   * @private
   */
  getErrorCode(error) {
    if (error.message.includes('Invalid')) {
      return 'INVALID_INPUT';
    }
    if (error.message.includes('not found')) {
      return 'NOT_FOUND';
    }
    return 'INTERNAL_ERROR';
  }
}

module.exports = GetVocabularyListUseCase;