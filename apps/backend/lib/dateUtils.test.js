const { formatKST, addDays, isWithinDays, parseKST } = require('./dateUtils');

describe('Date Utils', () => {
  describe('formatKST', () => {
    it('should format date in KST timezone', () => {
      const date = new Date('2023-01-01T00:00:00.000Z');
      const formatted = formatKST(date);
      
      expect(formatted).toMatch(/\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/);
    });

    it('should handle null date', () => {
      const formatted = formatKST(null);
      expect(formatted).toBeNull();
    });

    it('should handle current date', () => {
      const formatted = formatKST();
      expect(formatted).toMatch(/\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/);
    });
  });

  describe('addDays', () => {
    it('should add days to date', () => {
      const baseDate = new Date('2023-01-01');
      const result = addDays(baseDate, 5);
      
      expect(result.getDate()).toBe(6);
      expect(result.getMonth()).toBe(0); // January
      expect(result.getFullYear()).toBe(2023);
    });

    it('should handle negative days', () => {
      const baseDate = new Date('2023-01-10');
      const result = addDays(baseDate, -5);
      
      expect(result.getDate()).toBe(5);
    });

    it('should handle month rollover', () => {
      const baseDate = new Date('2023-01-30');
      const result = addDays(baseDate, 5);
      
      expect(result.getMonth()).toBe(1); // February
      expect(result.getDate()).toBe(4);
    });
  });

  describe('isWithinDays', () => {
    it('should return true for dates within range', () => {
      const baseDate = new Date('2023-01-01');
      const testDate = new Date('2023-01-03');
      
      const result = isWithinDays(testDate, baseDate, 5);
      expect(result).toBe(true);
    });

    it('should return false for dates outside range', () => {
      const baseDate = new Date('2023-01-01');
      const testDate = new Date('2023-01-10');
      
      const result = isWithinDays(testDate, baseDate, 5);
      expect(result).toBe(false);
    });

    it('should handle past dates', () => {
      const baseDate = new Date('2023-01-10');
      const testDate = new Date('2023-01-05');
      
      const result = isWithinDays(testDate, baseDate, 10);
      expect(result).toBe(true);
    });
  });

  describe('parseKST', () => {
    it('should parse KST date string', () => {
      const dateStr = '2023-01-01 12:00:00';
      const result = parseKST(dateStr);
      
      expect(result).toBeInstanceOf(Date);
      expect(result.getFullYear()).toBe(2023);
      expect(result.getMonth()).toBe(0); // January
      expect(result.getDate()).toBe(1);
    });

    it('should handle invalid date string', () => {
      const result = parseKST('invalid-date');
      expect(result).toBeNull();
    });

    it('should handle null input', () => {
      const result = parseKST(null);
      expect(result).toBeNull();
    });
  });
});