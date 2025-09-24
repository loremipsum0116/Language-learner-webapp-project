// server/services/alarmQueue.js
const { Queue } = require('bullmq');
const { connection, isRedisAvailable, skipRedis } = require('../lib/redis-safe');

// Queue is only created if Redis is available
const queue = !skipRedis && connection ? new Queue('alarm', { connection }) : null;

/**
 * 폴더 알림 예약(지연 작업)
 * @param {number} folderId
 * @param {Date|string|number} when - 실행 시각
 */
async function scheduleFolder(folderId, when) {
  if (!queue) {
    console.log('[AlarmQueue] Redis not available, skipping alarm scheduling');
    return null;
  }
  const ts = when instanceof Date ? when.getTime() : new Date(when).getTime();
  const delay = Math.max(0, ts - Date.now());
  return queue.add(`folder:${folderId}`, { folderId }, { delay });
}

module.exports = { connection, queue, scheduleFolder };
