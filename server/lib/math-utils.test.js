// lib/math-utils.test.js
const {
  calculatePercentage,
  clamp,
  average,
  roundTo,
  isInRange,
  randomBetween,
  randomIntBetween,
  sum
} = require('./math-utils');

describe('Math Utilities', () => {
  describe('calculatePercentage', () => {
    it('should calculate correct percentage', () => {
      expect(calculatePercentage(50, 100)).toBe(50);
      expect(calculatePercentage(25, 100)).toBe(25);
      expect(calculatePercentage(1, 3)).toBe(33);
      expect(calculatePercentage(2, 3)).toBe(67);
    });

    it('should return 0 when total is 0', () => {
      expect(calculatePercentage(50, 0)).toBe(0);
    });

    it('should handle edge cases', () => {
      expect(calculatePercentage(0, 100)).toBe(0);
      expect(calculatePercentage(100, 100)).toBe(100);
    });
  });

  describe('clamp', () => {
    it('should clamp values within range', () => {
      expect(clamp(5, 0, 10)).toBe(5);
      expect(clamp(-5, 0, 10)).toBe(0);
      expect(clamp(15, 0, 10)).toBe(10);
    });

    it('should handle edge cases', () => {
      expect(clamp(0, 0, 10)).toBe(0);
      expect(clamp(10, 0, 10)).toBe(10);
    });
  });

  describe('average', () => {
    it('should calculate average of numbers', () => {
      expect(average([1, 2, 3, 4, 5])).toBe(3);
      expect(average([10, 20])).toBe(15);
      expect(average([100])).toBe(100);
    });

    it('should return 0 for empty array', () => {
      expect(average([])).toBe(0);
    });

    it('should handle non-array inputs', () => {
      expect(average(null)).toBe(0);
      expect(average(undefined)).toBe(0);
      expect(average('not array')).toBe(0);
    });

    it('should ignore non-numeric values', () => {
      expect(average([1, 2, 'invalid', 3])).toBe(2);
      expect(average([null, undefined, 1, 2, 3])).toBe(2);
    });
  });

  describe('roundTo', () => {
    it('should round to specified decimal places', () => {
      expect(roundTo(3.14159, 2)).toBe(3.14);
      expect(roundTo(3.14159, 3)).toBe(3.142);
      expect(roundTo(3.14159, 0)).toBe(3);
    });

    it('should use 2 decimal places by default', () => {
      expect(roundTo(3.14159)).toBe(3.14);
      expect(roundTo(2.999)).toBe(3);
    });

    it('should handle whole numbers', () => {
      expect(roundTo(5)).toBe(5);
      expect(roundTo(5, 2)).toBe(5);
    });
  });

  describe('isInRange', () => {
    it('should return true for numbers in range', () => {
      expect(isInRange(5, 0, 10)).toBe(true);
      expect(isInRange(0, 0, 10)).toBe(true);
      expect(isInRange(10, 0, 10)).toBe(true);
    });

    it('should return false for numbers out of range', () => {
      expect(isInRange(-1, 0, 10)).toBe(false);
      expect(isInRange(11, 0, 10)).toBe(false);
    });
  });

  describe('randomBetween', () => {
    it('should generate numbers within range', () => {
      for (let i = 0; i < 100; i++) {
        const result = randomBetween(5, 10);
        expect(result).toBeGreaterThanOrEqual(5);
        expect(result).toBeLessThan(10);
      }
    });

    it('should handle equal min and max', () => {
      const result = randomBetween(5, 5);
      expect(result).toBe(5);
    });
  });

  describe('randomIntBetween', () => {
    it('should generate integers within range', () => {
      for (let i = 0; i < 100; i++) {
        const result = randomIntBetween(1, 5);
        expect(Number.isInteger(result)).toBe(true);
        expect(result).toBeGreaterThanOrEqual(1);
        expect(result).toBeLessThanOrEqual(5);
      }
    });

    it('should handle single value range', () => {
      const result = randomIntBetween(3, 3);
      expect(result).toBe(3);
    });
  });

  describe('sum', () => {
    it('should calculate sum of array', () => {
      expect(sum([1, 2, 3, 4, 5])).toBe(15);
      expect(sum([10, -5, 3])).toBe(8);
      expect(sum([0])).toBe(0);
    });

    it('should return 0 for empty array', () => {
      expect(sum([])).toBe(0);
    });

    it('should handle non-array inputs', () => {
      expect(sum(null)).toBe(0);
      expect(sum(undefined)).toBe(0);
      expect(sum('not array')).toBe(0);
    });

    it('should ignore non-numeric values', () => {
      expect(sum([1, 2, 'invalid', 3])).toBe(6);
      expect(sum([null, undefined, 1, 2, 3])).toBe(6);
    });
  });
});