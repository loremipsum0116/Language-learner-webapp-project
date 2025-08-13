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

/**
 * 정답 카드의 대기 시간을 계산합니다.
 * 망각곡선 일수에서 1일을 뺀 만큼 대기합니다.
 * 예: stage 1(3일) -> 2일(48시간) 대기, stage 2(7일) -> 6일(144시간) 대기
 */
function computeWaitingPeriod(stage) {
  const totalDelay = delayDaysFor(stage);
  console.log(`[SRS SCHEDULE] computeWaitingPeriod: stage=${stage}, totalDelay=${totalDelay} days`);
  
  // Stage 0은 즉시 복습 가능 (대기 시간 없음)
  if (stage === 0) {
    console.log(`[SRS SCHEDULE] Stage 0 -> immediate review (0 hours)`);
    return 0;
  }
  
  // Stage 1부터는 망각곡선 일수에서 1일을 뺀 만큼 대기
  // stage 1(3일) -> 2일 대기, stage 2(7일) -> 6일 대기, ...
  if (totalDelay <= 1) {
    console.log(`[SRS SCHEDULE] totalDelay <= 1 -> immediate review (0 hours)`);
    return 0; // 1일 이하인 경우 즉시 복습 가능
  }
  
  const waitingHours = (totalDelay - 1) * 24;
  console.log(`[SRS SCHEDULE] Stage ${stage} -> ${totalDelay} days - 1 = ${totalDelay - 1} days = ${waitingHours} hours`);
  return waitingHours; // 시간 단위로 반환
}

/**
 * 대기 시간 종료 시각을 계산합니다.
 */
function computeWaitingUntil(baseDate, stage) {
  const waitingHours = computeWaitingPeriod(stage);
  const result = new Date(baseDate.getTime() + waitingHours * 60 * 60 * 1000);
  console.log(`[SRS SCHEDULE] ✅ CORRECT ANSWER: stage ${stage} -> +${waitingHours} hours from ${baseDate.toISOString()} -> ${result.toISOString()}`);
  return result;
}

/**
 * 오답 카드의 24시간 대기 종료 시각을 계산합니다.
 */
function computeWrongAnswerWaitingUntil(baseDate) {
  const result = new Date(baseDate.getTime() + 24 * 60 * 60 * 1000);
  console.log(`[SRS SCHEDULE] ❌ WRONG ANSWER: +24 hours from ${baseDate.toISOString()} -> ${result.toISOString()}`);
  return result;
}

/**
 * overdue 상태의 24시간 데드라인을 계산합니다.
 */
function computeOverdueDeadline(overdueStartTime) {
  const result = new Date(overdueStartTime.getTime() + 24 * 60 * 60 * 1000);
  console.log(`[SRS SCHEDULE] computeOverdueDeadline: +24 hours from ${overdueStartTime.toISOString()}`);
  return result;
}

module.exports = {
  STAGE_DELAYS,
  clampStage,
  isMaxStage,
  isFinalStage,
  delayDaysFor,
  dateOnlyUTC,
  addDaysUTC,
  computeNextReviewDate,
  computeWaitingPeriod,
  computeWaitingUntil,
  computeWrongAnswerWaitingUntil,
  computeOverdueDeadline
};