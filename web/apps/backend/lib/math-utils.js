// lib/math-utils.js - Mathematical utility functions

/**
 * Calculate percentage
 */
function calculatePercentage(value, total) {
  if (total === 0) return 0;
  return Math.round((value / total) * 100);
}

/**
 * Clamp number between min and max
 */
function clamp(num, min, max) {
  return Math.min(Math.max(num, min), max);
}

/**
 * Calculate average of array
 */
function average(numbers) {
  if (!Array.isArray(numbers) || numbers.length === 0) return 0;
  const sum = numbers.reduce((acc, num) => acc + (typeof num === 'number' ? num : 0), 0);
  return sum / numbers.length;
}

/**
 * Round to decimal places
 */
function roundTo(num, decimals = 2) {
  const factor = Math.pow(10, decimals);
  return Math.round(num * factor) / factor;
}

/**
 * Check if number is within range
 */
function isInRange(num, min, max) {
  return num >= min && num <= max;
}

/**
 * Generate random number between min and max
 */
function randomBetween(min, max) {
  return Math.random() * (max - min) + min;
}

/**
 * Generate random integer between min and max (inclusive)
 */
function randomIntBetween(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Calculate sum of array
 */
function sum(numbers) {
  if (!Array.isArray(numbers)) return 0;
  return numbers.reduce((acc, num) => acc + (typeof num === 'number' ? num : 0), 0);
}

module.exports = {
  calculatePercentage,
  clamp,
  average,
  roundTo,
  isInRange,
  randomBetween,
  randomIntBetween,
  sum
};