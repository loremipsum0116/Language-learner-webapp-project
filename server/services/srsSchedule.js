// server/services/srsSchedule.js
// Forgetting-curve schedule (cap at 120 days).
// Stage 0(당일 학습) 이후 지연 일수: 3, 7, 14, 30, 60, 120
const STAGE_DELAYS = [3, 7, 14, 30, 60, 120]; // days

function clampStage(stage) {
  if (!Number.isFinite(stage)) return 0;
  if (stage < 0) return 0;
  if (stage > STAGE_DELAYS.length - 1) return STAGE_DELAYS.length - 1;
  return stage;
}
function isFinalStage(stage) {
  return clampStage(stage) === STAGE_DELAYS.length - 1;
}
function delayDaysFor(stage) {
  return STAGE_DELAYS[clampStage(stage)];
}
function dateOnlyUTC(yyyy_mm_dd) {
  // Return Date at 00:00:00Z for given YYYY-MM-DD
  return new Date(`${yyyy_mm_dd}T00:00:00.000Z`);
}
function addDaysUTC(date, days) {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + days);
  d.setUTCHours(0,0,0,0);
  return d;
}
/**
 * Compute next review date from baseDate and given stage.
 * stage=0 ⇒ +3d, stage=1 ⇒ +7d, ... capped at 120.
 * Returns Date at 00:00:00Z (treat as date-only).
 */
function computeNextReviewDate(baseDate, stage) {
  const delay = delayDaysFor(stage);
  return addDaysUTC(baseDate, delay);
}

module.exports = {
  STAGE_DELAYS,
  clampStage,
  isFinalStage,
  delayDaysFor,
  computeNextReviewDate,
  dateOnlyUTC,
  addDaysUTC,
};
