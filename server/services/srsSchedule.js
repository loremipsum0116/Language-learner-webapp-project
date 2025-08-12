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

function isFinalStage(stage) {
  return stage >= STAGE_DELAYS.length - 1; // Stage 5 is final (120 days)
}

function delayDaysFor(stage) {
  // CRITICAL FIX: stage 시스템 정리
  // stage 0: 즉시 복습 (새 단어/오답)
  // stage 1: 3일 후, stage 2: 7일 후, ..., stage 6: 120일 후
  if (stage <= 0) {
    return 0; // 즉시 복습
  }
  
  const index = Math.min(stage - 1, STAGE_DELAYS.length - 1);
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
  isFinalStage,
  delayDaysFor,
  dateOnlyUTC,
  addDaysUTC,
  computeNextReviewDate
};