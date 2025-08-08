// server/services/alarmQueue.js
const dayjs = require('dayjs');
const utc = require('dayjs/plugin/utc');
const tz = require('dayjs/plugin/timezone');
dayjs.extend(utc); dayjs.extend(tz);

const { Queue } = require('bullmq'); // bull을 쓰면 require('bull')
const IORedis = require('ioredis');

const connection = new IORedis(process.env.REDIS_URL || 'redis://127.0.0.1:6379');

// 공용 함수: KST 기준 다음 알림 슬롯(0/6/12/18시 또는 다음날 0시)
function nextAlarmSlot(now = dayjs()) {
  const kst = now.tz('Asia/Seoul');
  const hour = kst.hour();
  const slot = [0, 6, 12, 18].find(h => h > hour);
  const next = slot ?? 24; // 없으면 다음날 0시
  const base = slot != null ? kst.startOf('hour') : kst.add(1, 'day').startOf('day');
  return base.hour(next).minute(0).second(0).millisecond(0).toDate();
}

// BullMQ 큐
const queue = new Queue('alarm', { connection });

// 폴더 알림 스케줄러
async function scheduleFolder(folderId, when /* Date */) {
  const delay = Math.max(0, (when instanceof Date ? when : new Date(when)).getTime() - Date.now());
  return queue.add(`folder:${folderId}`, { folderId }, { delay });
}

module.exports = { queue, scheduleFolder, nextAlarmSlot };
