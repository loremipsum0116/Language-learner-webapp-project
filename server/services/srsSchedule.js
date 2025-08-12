// server/services/srsSchedule.js

const dayjs = require('dayjs');
const utc = require('dayjs/plugin/utc');
const timezone = require('dayjs/plugin/timezone');
dayjs.extend(utc);
dayjs.extend(timezone);

// SRS stages: 3d, 7d, 14d, 30d, 60d, 120d
const STAGE_DELAYS = [3, 7, 14, 30, 60, 120];

function clampStage(stage) {
  return Math.max(0, Math.min(stage, STAGE_DELAYS.length));
}

function isMaxStage(stage) {
  return clampStage(stage) === STAGE_DELAYS.length;
}

function delayDaysFor(stage) {
  // CRITICAL FIX: stage는 1부터 시작, 배열 인덱스는 0부터
  // stage 1 → index 0 (3일), stage 2 → index 1 (7일), ...
  const index = Math.max(0, clampStage(stage) - 1);
  console.log(`[SRS SCHEDULE] delayDaysFor stage ${stage} -> index ${index} -> ${STAGE_DELAYS[index]} days`);
  return STAGE_DELAYS[index];
}

function dateOnlyUTC(yyyy_mm_dd) {
  // Return Date at 00:00:00Z for given YYYY-MM-DD
  return new Date(yyyy_mm_dd + 'T00:00:00.000Z');
}

function addDaysUTC(date, days) {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

/**
 * Compute next review date from baseDate and given stage.
 * stage=1 ⇒ +3d, stage=2 ⇒ +7d, ... capped at 120.
 * Returns Date at 00:00:00Z (treat as date-only).
 */
function computeNextReviewDate(baseDate, stage) {
  const delay = delayDaysFor(stage);
  console.log(`[SRS SCHEDULE] computeNextReviewDate: stage ${stage} -> +${delay} days from ${baseDate.toISOString().split('T')[0]}`);
  return addDaysUTC(baseDate, delay);
}

module.exports = {
  STAGE_DELAYS,
  clampStage,
  isMaxStage,
  delayDaysFor,
  dateOnlyUTC,
  addDaysUTC,
  computeNextReviewDate
};