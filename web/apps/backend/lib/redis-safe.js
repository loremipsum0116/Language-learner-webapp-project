// Safe Redis wrapper that handles connection errors gracefully
const IORedis = require('ioredis');

let connection = null;
let isRedisAvailable = false;

// Skip Redis if SKIP_REDIS is set or REDIS_URL is not provided
const skipRedis = process.env.SKIP_REDIS === 'true' || !process.env.REDIS_URL;

if (!skipRedis) {
  try {
    connection = new IORedis(process.env.REDIS_URL || 'redis://127.0.0.1:6379', {
      maxRetriesPerRequest: 3,
      retryStrategy(times) {
        if (times > 3) {
          console.log('[Redis] Connection failed after 3 attempts, running without Redis');
          return null; // Stop retrying
        }
        return Math.min(times * 50, 2000);
      },
      lazyConnect: true,
    });

    connection.on('connect', () => {
      isRedisAvailable = true;
      console.log('[Redis] Connected successfully');
    });

    connection.on('error', (err) => {
      console.log('[Redis] Connection error (app will continue without Redis):', err.message);
      isRedisAvailable = false;
    });

    // Try to connect
    connection.connect().catch(err => {
      console.log('[Redis] Initial connection failed, running without Redis');
      isRedisAvailable = false;
    });
  } catch (err) {
    console.log('[Redis] Setup failed, running without Redis:', err.message);
    isRedisAvailable = false;
  }
} else {
  console.log('[Redis] Skipped (SKIP_REDIS=true or REDIS_URL not set)');
}

module.exports = {
  connection,
  isRedisAvailable: () => isRedisAvailable,
  skipRedis
};