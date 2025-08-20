// server/services/srsSchedule.js

const dayjs = require('dayjs');
const utc = require('dayjs/plugin/utc');
const timezone = require('dayjs/plugin/timezone');
dayjs.extend(utc);
dayjs.extend(timezone);

// 장기 학습 곡선 (long): Stage 0 → 1 → 2 → 3 → 4 → 5 → 6 → 7 → 마스터
// 대기 시간: [즉시, 1시간, 24h, 72h, 168h, 312h, 696h, 1440h, 마스터]
const STAGE_WAITING_HOURS = [1, 24, 72, 168, 312, 696, 1440]; // 시간 단위

// 기존 호환성을 위한 일수 배열 (폴더 시스템 등에서 사용)
const STAGE_DELAYS = [1/24, 1, 3, 7, 13, 29, 60]; // 시간을 일수로 변환

// 단기 스퍼트 곡선 (short): Stage 0 → 1 → ... → 9 → 마스터
// 대기 시간: [즉시, 1시간, 24h, 이후 모든 단계에서 2일(48h)]
const SHORT_CURVE_DELAYS = [1/24, 1, 2, 2, 2, 2, 2, 2, 2, 2]; // 10 stages: 1시간, 1일, 2일...
const SHORT_CURVE_WAITING_HOURS = [1, 24, 48, 48, 48, 48, 48, 48, 48, 48]; // 10 stages

function clampStage(stage) {
  return Math.max(0, Math.min(stage, STAGE_WAITING_HOURS.length));
}

function isMaxStage(stage) {
  return clampStage(stage) === STAGE_WAITING_HOURS.length;
}

function isFinalStage(stage, learningCurveType = "long") {
  if (learningCurveType === "free") {
    return false; // 자율 모드는 마스터 완료가 없음
  }
  if (learningCurveType === "short") {
    return stage >= SHORT_CURVE_WAITING_HOURS.length - 1; // Stage 9 is final for short curve (10 stages total, 0-9)
  }
  return stage >= STAGE_WAITING_HOURS.length; // Stage 6 완료 후 Stage 7이 마스터 (Stage 7부터 마스터)
}

function delayDaysFor(stage, learningCurveType = "long") {
  // 폴더 시스템을 위한 일수 계산
  if (stage <= 0) {
    return 0; // 즉시 복습
  }
  
  if (learningCurveType === "free") {
    return 0; // 자율 모드는 항상 즉시 복습 가능
  }
  
  if (learningCurveType === "short") {
    const index = Math.min(stage - 1, SHORT_CURVE_DELAYS.length - 1);
    // Short curve delay calculation
    return SHORT_CURVE_DELAYS[index];
  } else {
    const index = Math.min(stage - 1, STAGE_DELAYS.length - 1);
    // Long curve delay calculation
    return STAGE_DELAYS[index];
  }
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
function computeNextReviewDate(baseDate, stage, learningCurveType = "long") {
  const delay = delayDaysFor(stage, learningCurveType);
  // Next review date calculation
  return addDaysUTC(baseDate, delay);
}

/**
 * 정답 카드의 대기 시간을 계산합니다.
 * 명세서에 따른 직접적인 대기 시간을 적용합니다.
 * Stage 1: 48시간, Stage 2: 144시간, Stage 3: 14일, Stage 4: 30일, Stage 5: 60일, Stage 6: 120일
 */
function computeWaitingPeriod(stage, learningCurveType = "long") {
  // Waiting period calculation
  
  // 자율 모드는 대기 시간 없음
  if (learningCurveType === "free") {
    // Free mode - no waiting
    return 0;
  }
  
  // Stage 0은 즉시 복습 가능 (대기 시간 없음)
  if (stage === 0) {
    // Stage 0 - no waiting
    return 0;
  }
  
  if (learningCurveType === "short") {
    // 단기 스퍼트 곡선: 모든 단계에서 3일(72시간) 대기
    if (stage >= 1 && stage <= SHORT_CURVE_WAITING_HOURS.length) {
      const waitingHours = SHORT_CURVE_WAITING_HOURS[stage - 1];
      // Short curve stage waiting
      return waitingHours;
    }
    // 범위를 벗어나면 마지막 단계 적용
    const waitingHours = SHORT_CURVE_WAITING_HOURS[SHORT_CURVE_WAITING_HOURS.length - 1];
    // Short curve out of range
    return waitingHours;
  } else {
    // 기존 장기 학습 곡선
    if (stage >= 1 && stage <= STAGE_WAITING_HOURS.length) {
      const waitingHours = STAGE_WAITING_HOURS[stage - 1]; // stage 1은 인덱스 0
      // Long curve stage waiting
      return waitingHours;
    }
    // 범위를 벗어나면 마지막 단계 적용
    const waitingHours = STAGE_WAITING_HOURS[STAGE_WAITING_HOURS.length - 1];
    // Long curve out of range
    return waitingHours;
  }
}

/**
 * 대기 시간 종료 시각을 계산합니다. (가속 적용)
 */
function computeWaitingUntil(baseDate, stage, learningCurveType = "long") {
  try {
    const { getAcceleratedStageWaitTime } = require('../routes/timeAccelerator');
    const acceleratedMs = getAcceleratedStageWaitTime(stage, learningCurveType);
    const result = new Date(baseDate.getTime() + acceleratedMs);
    
    const originalHours = computeWaitingPeriod(stage, learningCurveType);
    const acceleratedMinutes = Math.round(acceleratedMs / (60 * 1000));
    
    // Correct answer (accelerated)
    
    return result;
  } catch (e) {
    // 가속 시스템 실패 시 원본 로직 사용
    const waitingHours = computeWaitingPeriod(stage, learningCurveType);
    const result = new Date(baseDate.getTime() + waitingHours * 60 * 60 * 1000);
    // Correct answer (fallback)
    return result;
  }
}

/**
 * 오답 카드의 대기 종료 시각을 계산합니다. (가속 적용)
 * stage0에서만 1시간, 이외는 24시간
 */
function computeWrongAnswerWaitingUntil(baseDate, currentStage = 0) {
  // stage0에서 틀렸을 경우에만 1시간, 이외에는 24시간
  const waitingHours = currentStage === 0 ? 1 : 24;
  
  try {
    // 새로운 오답 대기시간 가속 함수 사용
    const { getAcceleratedWrongAnswerWaitTime } = require('../routes/timeAccelerator');
    const acceleratedMs = getAcceleratedWrongAnswerWaitTime(currentStage);
    
    const result = new Date(baseDate.getTime() + acceleratedMs);
    const acceleratedMinutes = Math.round(acceleratedMs / (60 * 1000));
    
    // Wrong answer (accelerated)
    
    return result;
  } catch (e) {
    // 가속 시스템 실패 시 원본 로직 사용
    const result = new Date(baseDate.getTime() + waitingHours * 60 * 60 * 1000);
    // Wrong answer (fallback)
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
  SHORT_CURVE_DELAYS,
  SHORT_CURVE_WAITING_HOURS,
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