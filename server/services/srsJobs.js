// server/services/srsJobs.js
// Six-hourly notify & midnight roll logic for flat SRS (nextReviewDate + alarmActive).

const dayjs = require('dayjs');
const utc = require('dayjs/plugin/utc');
const tz = require('dayjs/plugin/timezone');
dayjs.extend(utc); dayjs.extend(tz);

const { prisma } = require('../lib/prismaClient');
const KST = 'Asia/Seoul';

function kstStartOfDay(d = dayjs()) { return d.tz(KST).startOf('day'); }
function kstNow() { return dayjs().tz(KST); }

/**
 * 6시간 간격 알림: 오늘(nextReviewDate=KST 오늘) & alarmActive=true & 미완료 폴더에 nextAlarmAt 찍기
 * 대시보드는 nextAlarmAt 갱신으로 "알림 표시"를 트리거
 */
async function sixHourlyNotify(logger = console) {
  const today = kstStartOfDay().toDate();
  const now = kstNow().toDate();
  const due = await prisma.srsFolder.findMany({
    where: { nextReviewDate: today, alarmActive: true, completedAt: null },
    select: { id: true },
  });
  if (!due.length) return logger.info('[srsJobs] sixHourlyNotify: no due folders');
  await prisma.srsFolder.updateMany({
    where: { id: { in: due.map((d) => d.id) } },
    data: { nextAlarmAt: now },
  });
  logger.info(`[srsJobs] sixHourlyNotify updated nextAlarmAt for ${due.length} folders`);
}

/**
 * 자정 컷오프: 어제(nextReviewDate=KST 어제)까지 미복습인 폴더는 alarmActive=false 로 전환
 */
async function midnightRoll(logger = console) {
  const yesterday = kstStartOfDay(dayjs().tz(KST).subtract(1,'day')).toDate();
  const res = await prisma.srsFolder.updateMany({
    where: { nextReviewDate: yesterday, completedAt: null, alarmActive: true },
    data: { alarmActive: false, nextAlarmAt: null },
  });
  logger.info(`[srsJobs] midnightRoll disabled ${res.count} stale alarms`);
}

// Export additional utility functions needed by other modules
function startOfKstDay(d = dayjs()) {
  // d가 Date 객체인 경우 dayjs로 변환
  const dayjsObj = dayjs.isDayjs(d) ? d : dayjs(d);
  return dayjsObj.tz(KST).startOf('day');
}

function addKstDays(kstDate, days) {
  // kstDate가 Date 객체인 경우 dayjs로 변환
  const dayjsObj = dayjs.isDayjs(kstDate) ? kstDate : dayjs(kstDate);
  return dayjsObj.add(days, 'day');
}

module.exports = { sixHourlyNotify, midnightRoll, startOfKstDay, addKstDays };
