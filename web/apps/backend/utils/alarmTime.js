// server/utils/alarmTime.js (CommonJS)
const dayjs = require('dayjs');
const utc = require('dayjs/plugin/utc');
const tz = require('dayjs/plugin/timezone');
dayjs.extend(utc); dayjs.extend(tz);

/**
 * KST 기준 다음 알림 슬롯(0,6,12,18시; 없으면 다음날 0시)을 dayjs로 반환
 * @param {dayjs.Dayjs} now - dayjs 객체(권장)
 * @returns {dayjs.Dayjs}
 */
function nextAlarmSlot(now) {
    const kst = (now || dayjs()).tz('Asia/Seoul');
    const hour = kst.hour();
    const slots = [0, 6, 12, 18];
    const next = slots.find(h => h > hour);
    const base = kst.minute(0).second(0).millisecond(0);
    return next == null ? base.add(1, 'day').hour(0) : base.hour(next);
}

module.exports = { nextAlarmSlot };
