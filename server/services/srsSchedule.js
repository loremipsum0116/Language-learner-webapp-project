// server/services/srsSchedule.js

const dayjs = require('dayjs');
const utc = require('dayjs/plugin/utc');
const timezone = require('dayjs/plugin/timezone');
dayjs.extend(utc);
dayjs.extend(timezone);

// SRS stages: 명세서에 따른 대기 시간 (시간 단위)
// Stage 1: 48시간, Stage 2: 144시간, Stage 3: 14일, Stage 4: 30일, Stage 5: 60일, Stage 6: 120일
const STAGE_WAITING_HOURS = [48, 144, 14*24, 30*24, 60*24, 120*24]; // 시간 단위

// 기존 호환성을 위한 일수 배열 (폴더 시스템 등에서 사용)
const STAGE_DELAYS = [3, 7, 14, 30, 60, 120];

function clampStage(stage) {
  return Math.max(0, Math.min(stage, STAGE_WAITING_HOURS.length));
}

function isMaxStage(stage) {
  return clampStage(stage) === STAGE_WAITING_HOURS.length;
}

function isFinalStage(stage) {
  return stage >= STAGE_WAITING_HOURS.length - 1; // Stage 5 is final (120 days)
}

function delayDaysFor(stage) {
  // 폴더 시스템을 위한 일수 계산 (기존 방식 유지)
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
 * 명세서에 따른 직접적인 대기 시간을 적용합니다.
 * Stage 1: 48시간, Stage 2: 144시간, Stage 3: 14일, Stage 4: 30일, Stage 5: 60일, Stage 6: 120일
 */
function computeWaitingPeriod(stage) {
  console.log(`[SRS SCHEDULE] computeWaitingPeriod: stage=${stage}`);
  
  // Stage 0은 즉시 복습 가능 (대기 시간 없음)
  if (stage === 0) {
    console.log(`[SRS SCHEDULE] Stage 0 -> immediate review (0 hours)`);
    return 0;
  }
  
  // Stage 1부터는 명세서에 정의된 대기 시간을 직접 적용
  if (stage >= 1 && stage <= STAGE_WAITING_HOURS.length) {
    const waitingHours = STAGE_WAITING_HOURS[stage - 1]; // stage 1은 인덱스 0
    console.log(`[SRS SCHEDULE] Stage ${stage} -> ${waitingHours} hours waiting`);
    return waitingHours;
  }
  
  // 범위를 벗어나면 마지막 단계 적용
  const waitingHours = STAGE_WAITING_HOURS[STAGE_WAITING_HOURS.length - 1];
  console.log(`[SRS SCHEDULE] Stage ${stage} (out of range) -> ${waitingHours} hours waiting`);
  return waitingHours;
}

/**
 * 대기 시간 종료 시각을 계산합니다. (가속 적용)
 */
function computeWaitingUntil(baseDate, stage) {
  try {
    const { getAcceleratedStageWaitTime } = require('../routes/timeAccelerator');
    const acceleratedMs = getAcceleratedStageWaitTime(stage);
    const result = new Date(baseDate.getTime() + acceleratedMs);
    
    const originalHours = computeWaitingPeriod(stage);
    const acceleratedMinutes = Math.round(acceleratedMs / (60 * 1000));
    
    console.log(`[SRS SCHEDULE] ✅ CORRECT ANSWER (ACCELERATED): stage ${stage}`);
    console.log(`  Original: +${originalHours} hours`);
    console.log(`  Accelerated: +${acceleratedMinutes} minutes`);
    console.log(`  ${baseDate.toISOString()} -> ${result.toISOString()}`);
    
    return result;
  } catch (e) {
    // 가속 시스템 실패 시 원본 로직 사용
    const waitingHours = computeWaitingPeriod(stage);
    const result = new Date(baseDate.getTime() + waitingHours * 60 * 60 * 1000);
    console.log(`[SRS SCHEDULE] ✅ CORRECT ANSWER (FALLBACK): stage ${stage} -> +${waitingHours} hours from ${baseDate.toISOString()} -> ${result.toISOString()}`);
    return result;
  }
}

/**
 * 오답 카드의 24시간 대기 종료 시각을 계산합니다. (가속 적용)
 */
function computeWrongAnswerWaitingUntil(baseDate) {
  try {
    const { getAccelerated24Hours } = require('../routes/timeAccelerator');
    const acceleratedMs = getAccelerated24Hours();
    const result = new Date(baseDate.getTime() + acceleratedMs);
    
    const acceleratedMinutes = Math.round(acceleratedMs / (60 * 1000));
    
    console.log(`[SRS SCHEDULE] ❌ WRONG ANSWER (ACCELERATED):`);
    console.log(`  Original: +24 hours`);
    console.log(`  Accelerated: +${acceleratedMinutes} minutes`);
    console.log(`  ${baseDate.toISOString()} -> ${result.toISOString()}`);
    
    return result;
  } catch (e) {
    // 가속 시스템 실패 시 원본 로직 사용
    const result = new Date(baseDate.getTime() + 24 * 60 * 60 * 1000);
    console.log(`[SRS SCHEDULE] ❌ WRONG ANSWER (FALLBACK): +24 hours from ${baseDate.toISOString()} -> ${result.toISOString()}`);
    return result;
  }
}

/**
 * overdue 상태의 24시간 데드라인을 계산합니다. (가속 적용)
 */
function computeOverdueDeadline(overdueStartTime) {
  try {
    const { getAccelerated24Hours } = require('../routes/timeAccelerator');
    const acceleratedMs = getAccelerated24Hours();
    const result = new Date(overdueStartTime.getTime() + acceleratedMs);
    
    const acceleratedMinutes = Math.round(acceleratedMs / (60 * 1000));
    
    console.log(`[SRS SCHEDULE] computeOverdueDeadline (ACCELERATED):`);
    console.log(`  Original: +24 hours`);
    console.log(`  Accelerated: +${acceleratedMinutes} minutes`);
    console.log(`  ${overdueStartTime.toISOString()} -> ${result.toISOString()}`);
    
    return result;
  } catch (e) {
    // 가속 시스템 실패 시 원본 로직 사용
    const result = new Date(overdueStartTime.getTime() + 24 * 60 * 60 * 1000);
    console.log(`[SRS SCHEDULE] computeOverdueDeadline (FALLBACK): +24 hours from ${overdueStartTime.toISOString()}`);
    return result;
  }
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