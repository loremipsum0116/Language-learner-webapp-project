// server/middleware/cache.js - Caching middleware for performance
const NodeCache = require('node-cache');
const redis = require('redis');

// In-memory cache for quick access
const memoryCache = new NodeCache({ 
  stdTTL: 300, // 5 minutes default TTL
  checkperiod: 60, // Check for expired keys every 60 seconds
  maxKeys: 1000 // Maximum number of keys
});

// Redis cache for persistent storage
let redisClient = null;

const initializeRedisCache = async () => {
  try {
    if (process.env.REDIS_URL) {
      redisClient = redis.createClient({
        url: process.env.REDIS_URL
      });
      
      await redisClient.connect();
      console.log('Redis cache connected successfully');
    } else {
      console.log('Redis URL not provided, using memory cache only');
    }
  } catch (error) {
    console.warn('Redis connection failed, falling back to memory cache:', error.message);
    redisClient = null;
  }
};

// Initialize Redis on startup
initializeRedisCache();

// Cache middleware factory
const createCacheMiddleware = (options = {}) => {
  const {
    ttl = 300, // 5 minutes
    keyGenerator = (req) => `${req.method}:${req.originalUrl}`,
    condition = () => true,
    useRedis = true
  } = options;

  return async (req, res, next) => {
    // Skip caching for non-GET requests or if condition fails
    if (req.method !== 'GET' || !condition(req)) {
      return next();
    }

    const cacheKey = keyGenerator(req);

    try {
      // Try memory cache first
      let cachedData = memoryCache.get(cacheKey);

      if (!cachedData && redisClient && useRedis) {
        // Try Redis cache
        const redisCached = await redisClient.get(cacheKey);
        if (redisCached) {
          cachedData = JSON.parse(redisCached);
          // Store in memory cache for faster access
          memoryCache.set(cacheKey, cachedData, ttl);
        }
      }

      if (cachedData) {
        console.log(`[Cache HIT] ${cacheKey}`);
        return res.json(cachedData);
      }

      // Cache miss - intercept response
      const originalSend = res.json;
      res.json = function(data) {
        // Only cache successful responses
        if (res.statusCode === 200 && data) {
          // Store in memory cache
          memoryCache.set(cacheKey, data, ttl);

          // Store in Redis if available
          if (redisClient && useRedis) {
            redisClient.setEx(cacheKey, ttl, JSON.stringify(data)).catch(err => {
              console.warn('Redis cache set failed:', err.message);
            });
          }

          console.log(`[Cache SET] ${cacheKey}`);
        }

        originalSend.call(this, data);
      };

      next();
    } catch (error) {
      console.error('Cache middleware error:', error);
      next();
    }
  };
};

// Specific cache middlewares
const vocabularyCache = createCacheMiddleware({
  ttl: 600, // 10 minutes for vocabulary data
  keyGenerator: (req) => `vocab:${req.originalUrl}:${req.user?.id || 'anonymous'}`
});

const srsCache = createCacheMiddleware({
  ttl: 120, // 2 minutes for SRS data (more dynamic)
  keyGenerator: (req) => `srs:${req.originalUrl}:${req.user?.id}`
});

const userStatsCache = createCacheMiddleware({
  ttl: 300, // 5 minutes for user statistics
  keyGenerator: (req) => `stats:${req.params.userId || req.user?.id}`
});

// Cache invalidation utilities
const invalidateCache = (pattern) => {
  // Clear memory cache
  const keys = memoryCache.keys();
  keys.forEach(key => {
    if (key.includes(pattern)) {
      memoryCache.del(key);
      console.log(`[Cache INVALIDATE] Memory: ${key}`);
    }
  });

  // Clear Redis cache
  if (redisClient) {
    redisClient.keys(`*${pattern}*`).then(keys => {
      if (keys.length > 0) {
        redisClient.del(keys).then(() => {
          console.log(`[Cache INVALIDATE] Redis: ${keys.length} keys`);
        });
      }
    }).catch(err => {
      console.warn('Redis cache invalidation failed:', err.message);
    });
  }
};

const invalidateUserCache = (userId) => {
  invalidateCache(`${userId}`);
};

const invalidateVocabularyCache = () => {
  invalidateCache('vocab:');
};

const invalidateSrsCache = (userId) => {
  invalidateCache(`srs:`);
  if (userId) {
    invalidateCache(`${userId}`);
  }
};

// Cache statistics
const getCacheStats = () => {
  const memoryStats = memoryCache.getStats();
  return {
    memory: {
      keys: memoryStats.keys,
      hits: memoryStats.hits,
      misses: memoryStats.misses,
      hitRate: (memoryStats.hits / (memoryStats.hits + memoryStats.misses) * 100).toFixed(2) + '%'
    },
    redis: redisClient ? 'Connected' : 'Not available'
  };
};

module.exports = {
  createCacheMiddleware,
  vocabularyCache,
  srsCache,
  userStatsCache,
  invalidateCache,
  invalidateUserCache,
  invalidateVocabularyCache,
  invalidateSrsCache,
  getCacheStats
};