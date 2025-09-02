// server/utils/queryOptimizer.js - Database query optimization utilities
const { queryPerformanceTracker } = require('../middleware/performance');

// Query builder with performance tracking
class OptimizedQuery {
  constructor(model) {
    this.model = model;
    this.queryOptions = {};
    this.startTime = null;
  }

  // Add select fields to reduce data transfer
  select(fields) {
    if (Array.isArray(fields)) {
      this.queryOptions.select = fields.reduce((obj, field) => {
        obj[field] = true;
        return obj;
      }, {});
    } else {
      this.queryOptions.select = fields;
    }
    return this;
  }

  // Add efficient pagination
  paginate(page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    this.queryOptions.skip = skip;
    this.queryOptions.take = Math.min(limit, 100); // Max 100 items per page
    return this;
  }

  // Add optimized includes with select
  include(relations) {
    this.queryOptions.include = relations;
    return this;
  }

  // Add where conditions
  where(conditions) {
    this.queryOptions.where = conditions;
    return this;
  }

  // Add ordering
  orderBy(field, direction = 'asc') {
    this.queryOptions.orderBy = { [field]: direction };
    return this;
  }

  // Execute with performance tracking
  async execute(operation = 'findMany') {
    this.startTime = process.hrtime.bigint();
    
    try {
      let result;
      switch (operation) {
        case 'findMany':
          result = await this.model.findMany(this.queryOptions);
          break;
        case 'findFirst':
          result = await this.model.findFirst(this.queryOptions);
          break;
        case 'findUnique':
          result = await this.model.findUnique(this.queryOptions);
          break;
        case 'count':
          result = await this.model.count({ where: this.queryOptions.where });
          break;
        default:
          throw new Error(`Unsupported operation: ${operation}`);
      }

      this.trackPerformance(operation, null);
      return result;
    } catch (error) {
      this.trackPerformance(operation, error);
      throw error;
    }
  }

  trackPerformance(operation, error) {
    if (this.startTime) {
      const endTime = process.hrtime.bigint();
      const duration = Number(endTime - this.startTime) / 1000000; // Convert to milliseconds
      
      const queryString = `${this.model.name}.${operation}(${JSON.stringify(this.queryOptions)})`;
      queryPerformanceTracker.track(queryString, duration, error);
    }
  }
}

// Factory function for creating optimized queries
const createOptimizedQuery = (model) => {
  return new OptimizedQuery(model);
};

// Common query patterns
const CommonQueries = {
  // Paginated vocabulary with minimal data
  getVocabularyList: (prisma, { page = 1, limit = 20, level = null, userId = null }) => {
    const query = createOptimizedQuery(prisma.vocabulary)
      .select(['id', 'word', 'meaning', 'level', 'createdAt'])
      .paginate(page, limit)
      .orderBy('createdAt', 'desc');

    if (level) {
      query.where({ level });
    }

    return query.execute();
  },

  // User's SRS items with optimized includes
  getSrsItems: (prisma, { userId, limit = 20, dueOnly = false }) => {
    const query = createOptimizedQuery(prisma.srsItem)
      .select(['id', 'vocabularyId', 'level', 'nextReviewAt', 'easeFactor'])
      .include({
        vocabulary: {
          select: ['word', 'meaning', 'pronunciation']
        }
      })
      .where({ userId })
      .paginate(1, limit)
      .orderBy('nextReviewAt', 'asc');

    if (dueOnly) {
      query.where({
        userId,
        nextReviewAt: {
          lte: new Date()
        }
      });
    }

    return query.execute();
  },

  // User statistics with aggregation
  getUserStats: async (prisma, userId) => {
    const query = createOptimizedQuery(prisma.srsItem);
    
    // Use raw query for better performance on aggregations
    const startTime = process.hrtime.bigint();
    
    try {
      const stats = await prisma.$queryRaw`
        SELECT 
          COUNT(*) as totalItems,
          COUNT(CASE WHEN "nextReviewAt" <= NOW() THEN 1 END) as dueItems,
          AVG("easeFactor") as avgEaseFactor,
          COUNT(CASE WHEN "level" >= 4 THEN 1 END) as masteredItems
        FROM "SrsItem" 
        WHERE "userId" = ${userId}
      `;

      const endTime = process.hrtime.bigint();
      const duration = Number(endTime - startTime) / 1000000;
      
      queryPerformanceTracker.track(
        `getUserStats for user ${userId}`, 
        duration, 
        null
      );

      return stats[0];
    } catch (error) {
      const endTime = process.hrtime.bigint();
      const duration = Number(endTime - startTime) / 1000000;
      
      queryPerformanceTracker.track(
        `getUserStats for user ${userId}`, 
        duration, 
        error
      );
      
      throw error;
    }
  },

  // Bulk operations for better performance
  bulkCreateSrsItems: async (prisma, items) => {
    const startTime = process.hrtime.bigint();
    
    try {
      // Use createMany for better performance
      const result = await prisma.srsItem.createMany({
        data: items,
        skipDuplicates: true
      });

      const endTime = process.hrtime.bigint();
      const duration = Number(endTime - startTime) / 1000000;
      
      queryPerformanceTracker.track(
        `bulkCreateSrsItems (${items.length} items)`, 
        duration, 
        null
      );

      return result;
    } catch (error) {
      const endTime = process.hrtime.bigint();
      const duration = Number(endTime - startTime) / 1000000;
      
      queryPerformanceTracker.track(
        `bulkCreateSrsItems (${items.length} items)`, 
        duration, 
        error
      );
      
      throw error;
    }
  }
};

// Connection pool optimization
const optimizePrismaConnection = (prisma) => {
  // Set connection pool settings for better performance
  const connectionString = process.env.DATABASE_URL;
  
  if (connectionString) {
    const url = new URL(connectionString);
    
    // Add connection pool parameters if not present
    if (!url.searchParams.has('connection_limit')) {
      url.searchParams.set('connection_limit', '10');
    }
    if (!url.searchParams.has('pool_timeout')) {
      url.searchParams.set('pool_timeout', '20');
    }
    
    process.env.DATABASE_URL = url.toString();
  }
};

// Query performance middleware for debugging
const logSlowQueries = (threshold = 100) => {
  return async (params, next) => {
    const startTime = Date.now();
    const result = await next(params);
    const duration = Date.now() - startTime;
    
    if (duration > threshold) {
      console.log(`[SLOW QUERY] ${duration}ms - ${params.model}.${params.action}`);
    }
    
    return result;
  };
};

module.exports = {
  OptimizedQuery,
  createOptimizedQuery,
  CommonQueries,
  optimizePrismaConnection,
  logSlowQueries
};