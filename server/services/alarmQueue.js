// server/services/alarmQueue.js
const { Queue } = require('bullmq');
const IORedis = require('ioredis');

// ⚠️ 싱글톤 구성을 권장합니다. 앱 전역에서 이 모듈만 import 하세요.
const connection = new IORedis(process.env.REDIS_URL || 'redis://127.0.0.1:6379');

const queue = new Queue('alarm', { connection });

/**
 * 폴더 알림 예약(지연 작업)
 * @param {number} folderId
 * @param {Date|string|number} when - 실행 시각
 */
async function scheduleFolder(folderId, when) {
  const ts = when instanceof Date ? when.getTime() : new Date(when).getTime();
  const delay = Math.max(0, ts - Date.now());
  return queue.add(`folder:${folderId}`, { folderId }, { delay });
}

module.exports = { connection, queue, scheduleFolder };
