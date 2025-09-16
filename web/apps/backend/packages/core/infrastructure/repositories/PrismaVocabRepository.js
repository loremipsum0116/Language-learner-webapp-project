// packages/core/infrastructure/repositories/PrismaVocabRepository.js
const IVocabRepository = require('../../domain/repositories/IVocabRepository');
const Vocab = require('../../domain/entities/Vocab');

/**
 * Prisma implementation of Vocab Repository
 * Handles all data access for vocabulary using Prisma ORM
 */
class PrismaVocabRepository extends IVocabRepository {
  constructor(prismaClient) {
    super();
    this.prisma = prismaClient;
  }

  /**
   * Find vocabulary by ID
   */
  async findById(id) {
    const vocabData = await this.prisma.vocab.findUnique({
      where: { id },
      include: { dictentry: true }
    });

    return vocabData ? this.toDomainEntity(vocabData) : null;
  }

  /**
   * Find vocabulary by lemma (word)
   */
  async findByLemma(lemma) {
    const vocabsData = await this.prisma.vocab.findMany({
      where: { lemma: { equals: lemma } },
      include: { dictentry: true },
      orderBy: { lemma: 'asc' }
    });

    return vocabsData.map(data => this.toDomainEntity(data));
  }

  /**
   * Find vocabulary by level with optional filtering
   */
  async findByLevel(criteria) {
    const { level, pos, source, search, limit, offset } = criteria;
    const where = {};

    if (search && search.trim()) {
      // 영단어 또는 한국어 뜻으로 검색
      where.OR = [
        { lemma: { contains: search.trim() } },
        { translations: { some: {
          AND: [
            { languageId: 2 }, // Korean language ID
            { translation: { contains: search.trim() } }
          ]
        }}}
      ];
    } else {
      where.levelCEFR = level;
    }

    if (pos) {
      where.pos = pos;
    }

    if (source) {
      where.source = source;
    } else if (criteria.excludeSources) {
      where.source = { notIn: criteria.excludeSources };
    }

    const vocabsData = await this.prisma.vocab.findMany({
      where,
      include: {
        dictentry: true,
        translations: {
          where: { languageId: 2 } // Include Korean translations
        }
      },
      orderBy: { lemma: 'asc' },
      take: limit,
      skip: offset
    });

    return vocabsData.map(data => this.toDomainEntity(data));
  }

  /**
   * Find vocabulary by part of speech
   */
  async findByPartOfSpeech(pos, options = {}) {
    const { search, source } = options;
    const where = { pos };

    if (search && search.trim()) {
      where.OR = [
        { lemma: { contains: search.trim() } },
        { translations: { some: {
          AND: [
            { languageId: 2 }, // Korean language ID
            { translation: { contains: search.trim() } }
          ]
        }}}
      ];
    }

    if (source) {
      where.source = source;
    }

    const vocabsData = await this.prisma.vocab.findMany({
      where,
      include: {
        dictentry: true,
        translations: {
          where: { languageId: 2 } // Include Korean translations
        }
      },
      orderBy: { lemma: 'asc' }
    });

    return vocabsData.map(data => this.toDomainEntity(data));
  }

  /**
   * Find idioms and phrasal verbs
   */
  async findIdioms(filters = {}) {
    const { pos, search } = filters;
    const where = {
      source: { in: ['idiom', 'idiom_migration'] }
    };

    if (pos) {
      where.pos = pos;
    }

    if (search && search.trim()) {
      where.OR = [
        { lemma: { contains: search.trim() } },
        { translations: { some: {
          AND: [
            { languageId: 2 }, // Korean language ID
            { translation: { contains: search.trim() } }
          ]
        }}}
      ];
    }

    const vocabsData = await this.prisma.vocab.findMany({
      where,
      include: {
        dictentry: true,
        translations: {
          where: { languageId: 2 } // Include Korean translations
        }
      },
      orderBy: { lemma: 'asc' }
    });

    return vocabsData.map(data => this.toDomainEntity(data));
  }

  /**
   * Search vocabulary with full-text search
   */
  async search(searchTerm, options = {}) {
    const { limit = 100, levels } = options;
    const where = {
      OR: [
        { lemma: { contains: searchTerm } },
        { translations: { some: {
          AND: [
            { languageId: 2 }, // Korean language ID
            { translation: { contains: searchTerm } }
          ]
        }}}
      ]
    };

    if (levels && levels.length > 0) {
      where.levelCEFR = { in: levels };
    }

    const vocabsData = await this.prisma.vocab.findMany({
      where,
      include: {
        dictentry: true,
        translations: {
          where: { languageId: 2 } // Include Korean translations
        }
      },
      orderBy: { lemma: 'asc' },
      take: limit
    });

    return vocabsData.map(data => this.toDomainEntity(data));
  }

  /**
   * Get vocabulary count by criteria
   */
  async countByCriteria(criteria) {
    const { level, pos, source, search } = criteria;
    const where = {};

    if (search && search.trim()) {
      where.OR = [
        { lemma: { contains: search.trim() } },
        { translations: { some: {
          AND: [
            { languageId: 2 }, // Korean language ID
            { translation: { contains: search.trim() } }
          ]
        }}}
      ];
    } else if (level) {
      where.levelCEFR = level;
    }

    if (pos) {
      where.pos = pos;
    }

    if (source) {
      where.source = source;
    } else if (criteria.excludeSources) {
      where.source = { notIn: criteria.excludeSources };
    }

    return await this.prisma.vocab.count({ where });
  }

  /**
   * Create new vocabulary entry
   */
  async create(vocabData) {
    const createdVocab = await this.prisma.vocab.create({
      data: {
        lemma: vocabData.lemma,
        pos: vocabData.pos,
        plural: vocabData.plural,
        levelCEFR: vocabData.levelCEFR,
        freq: vocabData.frequency,
        source: vocabData.source
      },
      include: { dictentry: true }
    });

    return this.toDomainEntity(createdVocab);
  }

  /**
   * Update vocabulary entry
   */
  async update(id, updateData) {
    const updatedVocab = await this.prisma.vocab.update({
      where: { id },
      data: updateData,
      include: { dictentry: true }
    });

    return this.toDomainEntity(updatedVocab);
  }

  /**
   * Delete vocabulary entry
   */
  async delete(id) {
    try {
      await this.prisma.vocab.delete({ where: { id } });
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Find vocabulary with dictionary entries included
   */
  async findWithDictEntries(criteria) {
    // This is the same as findByLevel with dictentry always included
    return this.findByLevel(criteria);
  }

  /**
   * Get random vocabulary for practice
   */
  async getRandomVocabs(criteria, count) {
    const where = this.buildWhereClause(criteria);
    
    // Get total count first
    const totalCount = await this.prisma.vocab.count({ where });
    
    if (totalCount === 0) return [];
    
    // Generate random offsets
    const randomOffsets = [];
    for (let i = 0; i < Math.min(count, totalCount); i++) {
      randomOffsets.push(Math.floor(Math.random() * totalCount));
    }
    
    // Fetch vocabs at random positions
    const randomVocabs = await Promise.all(
      randomOffsets.map(offset =>
        this.prisma.vocab.findMany({
          where,
          include: { dictentry: true },
          skip: offset,
          take: 1
        })
      )
    );

    return randomVocabs
      .filter(result => result.length > 0)
      .map(result => this.toDomainEntity(result[0]));
  }

  /**
   * Build where clause from criteria
   * @private
   */
  buildWhereClause(criteria) {
    const where = {};
    
    if (criteria.level) {
      where.levelCEFR = criteria.level;
    }
    
    if (criteria.pos) {
      where.pos = criteria.pos;
    }
    
    if (criteria.source) {
      where.source = criteria.source;
    }
    
    if (criteria.search) {
      where.lemma = { contains: criteria.search };
    }

    return where;
  }

  /**
   * Transform Prisma data to Domain Entity
   * @private
   */
  toDomainEntity(vocabData) {
    // Get Korean translation if available
    const koTranslation = vocabData.translations && vocabData.translations.find(t => t.languageId === 2);

    return new Vocab({
      id: vocabData.id,
      lemma: vocabData.lemma,
      pos: vocabData.pos,
      plural: vocabData.plural,
      levelCEFR: vocabData.levelCEFR,
      levelJLPT: vocabData.levelJLPT, // Add JLPT level
      frequency: vocabData.freq,
      source: vocabData.source,
      koGloss: koTranslation ? koTranslation.translation : null, // Add Korean translation
      dictEntry: vocabData.dictentry ? {
        ipa: vocabData.dictentry.ipa,
        ipaKo: vocabData.dictentry.ipaKo,
        audioUrl: vocabData.dictentry.audioUrl,
        audioLocal: vocabData.dictentry.audioLocal,
        examples: vocabData.dictentry.examples
      } : null
    });
  }
}

module.exports = PrismaVocabRepository;