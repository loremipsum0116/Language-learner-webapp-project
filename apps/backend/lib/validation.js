// lib/validation.js - Simple validation utilities

/**
 * Check if email is valid
 */
function isValidEmail(email) {
  if (!email || typeof email !== 'string') return false;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Check if password meets requirements
 */
function isValidPassword(password) {
  if (!password || typeof password !== 'string') return false;
  return password.length >= 6;
}

/**
 * Check if string is not empty
 */
function isNotEmpty(str) {
  return str && typeof str === 'string' && str.trim().length > 0;
}

/**
 * Check if number is positive integer
 */
function isPositiveInteger(num) {
  return Number.isInteger(num) && num > 0;
}

/**
 * Check if array has items
 */
function hasItems(arr) {
  return Array.isArray(arr) && arr.length > 0;
}

/**
 * Sanitize string input
 */
function sanitizeString(input, maxLength = 255) {
  if (!input || typeof input !== 'string') return '';
  return input.trim().slice(0, maxLength);
}

/**
 * Check if object has required properties
 */
function hasRequiredProperties(obj, requiredProps) {
  if (!obj || typeof obj !== 'object') return false;
  return requiredProps.every(prop => obj.hasOwnProperty(prop));
}

/**
 * Check if ID is valid
 */
function isValidId(id) {
  const numId = parseInt(id);
  return !isNaN(numId) && numId > 0;
}

module.exports = {
  isValidEmail,
  isValidPassword,
  isNotEmpty,
  isPositiveInteger,
  hasItems,
  sanitizeString,
  hasRequiredProperties,
  isValidId
};