// lib/kst.test.js
const {
  startOfKstDay,
  kstAddDays,
  kstAt,
  parseKstDateYYYYMMDD,
  nowKst,
  utcToKst,
  kstToUtc,
  formatKstDateTime,
  formatKstDate
} = require('./kst');

describe('KST Utilities', () => {
  const KST_OFFSET = 9 * 60 * 60 * 1000;

  describe('nowKst', () => {
    it('should return current time in KST', () => {
      const before = Date.now() + KST_OFFSET;
      const kstTime = nowKst();
      const after = Date.now() + KST_OFFSET;
      
      expect(kstTime.getTime()).toBeGreaterThanOrEqual(before - 100);
      expect(kstTime.getTime()).toBeLessThanOrEqual(after + 100);
    });
  });

  describe('utcToKst', () => {
    it('should convert UTC time to KST', () => {
      const utcDate = new Date('2024-01-01T00:00:00.000Z');
      const kstDate = utcToKst(utcDate);
      
      expect(kstDate.getTime()).toBe(utcDate.getTime() + KST_OFFSET);
    });

    it('should handle different UTC times', () => {
      const testCases = [
        '2024-01-01T12:00:00.000Z',
        '2024-06-15T06:30:00.000Z',
        '2024-12-31T23:59:59.999Z'
      ];

      testCases.forEach(utcString => {
        const utcDate = new Date(utcString);
        const kstDate = utcToKst(utcDate);
        
        expect(kstDate.getTime()).toBe(utcDate.getTime() + KST_OFFSET);
      });
    });
  });

  describe('kstToUtc', () => {
    it('should convert KST time to UTC', () => {
      const kstDate = new Date('2024-01-01T09:00:00.000');
      const utcDate = kstToUtc(kstDate);
      
      expect(utcDate.getTime()).toBe(kstDate.getTime() - KST_OFFSET);
    });

    it('should be inverse of utcToKst', () => {
      const originalUtc = new Date('2024-01-01T00:00:00.000Z');
      const kst = utcToKst(originalUtc);
      const backToUtc = kstToUtc(kst);
      
      expect(backToUtc.getTime()).toBe(originalUtc.getTime());
    });
  });

  describe('startOfKstDay', () => {
    it('should return start of current KST day when no date provided', () => {
      const startOfDay = startOfKstDay();
      
      expect(startOfDay.getUTCHours()).toBe(0);
      expect(startOfDay.getUTCMinutes()).toBe(0);
      expect(startOfDay.getUTCSeconds()).toBe(0);
      expect(startOfDay.getUTCMilliseconds()).toBe(0);
    });

    it('should return start of specific KST day', () => {
      const inputDate = new Date('2024-01-15T15:30:45.123Z');
      const startOfDay = startOfKstDay(inputDate);
      
      expect(startOfDay.getUTCHours()).toBe(0);
      expect(startOfDay.getUTCMinutes()).toBe(0);
      expect(startOfDay.getUTCSeconds()).toBe(0);
      expect(startOfDay.getUTCMilliseconds()).toBe(0);
    });

    it('should handle dates across day boundaries', () => {
      const lateTonightUtc = new Date('2024-01-01T20:00:00.000Z'); // Next day in KST
      const startOfDay = startOfKstDay(lateTonightUtc);
      
      // Should be Jan 2nd 00:00 UTC (representing KST day boundary)
      expect(startOfDay.getUTCDate()).toBe(2);
      expect(startOfDay.getUTCHours()).toBe(0);
    });
  });

  describe('kstAddDays', () => {
    it('should add positive days', () => {
      const baseDate = new Date('2024-01-01T00:00:00.000Z');
      const result = kstAddDays(baseDate, 5);
      
      expect(result.getTime()).toBe(baseDate.getTime() + 5 * 24 * 60 * 60 * 1000);
    });

    it('should subtract days with negative input', () => {
      const baseDate = new Date('2024-01-10T00:00:00.000Z');
      const result = kstAddDays(baseDate, -3);
      
      expect(result.getTime()).toBe(baseDate.getTime() - 3 * 24 * 60 * 60 * 1000);
    });

    it('should handle zero days', () => {
      const baseDate = new Date('2024-01-01T12:00:00.000Z');
      const result = kstAddDays(baseDate, 0);
      
      expect(result.getTime()).toBe(baseDate.getTime());
    });
  });

  describe('kstAt', () => {
    it('should set time with default values (9:00:00)', () => {
      const baseDate = new Date('2024-01-01T15:30:45.123Z');
      const result = kstAt(baseDate);
      
      expect(result.getHours()).toBe(9);
      expect(result.getMinutes()).toBe(0);
      expect(result.getSeconds()).toBe(0);
      expect(result.getMilliseconds()).toBe(0);
    });

    it('should set custom time', () => {
      const baseDate = new Date('2024-01-01T00:00:00.000Z');
      const result = kstAt(baseDate, 14, 30, 15);
      
      expect(result.getHours()).toBe(14);
      expect(result.getMinutes()).toBe(30);
      expect(result.getSeconds()).toBe(15);
      expect(result.getMilliseconds()).toBe(0);
    });

    it('should preserve original date', () => {
      const originalDate = new Date('2024-06-15T00:00:00.000Z');
      const result = kstAt(originalDate, 10, 15, 30);
      
      expect(result.getFullYear()).toBe(2024);
      expect(result.getMonth()).toBe(5); // June (0-indexed)
      expect(result.getDate()).toBe(15);
    });
  });

  describe('parseKstDateYYYYMMDD', () => {
    it('should parse valid date string', () => {
      const result = parseKstDateYYYYMMDD('2024-01-15');
      
      expect(result.getFullYear()).toBe(2024);
      expect(result.getMonth()).toBe(0); // January (0-indexed)
      expect(result.getDate()).toBe(15);
    });

    it('should handle different date formats', () => {
      const testCases = [
        { input: '2024-12-31', expected: { year: 2024, month: 11, date: 31 } },
        { input: '2023-02-28', expected: { year: 2023, month: 1, date: 28 } },
        { input: '2024-02-29', expected: { year: 2024, month: 1, date: 29 } } // Leap year
      ];

      testCases.forEach(({ input, expected }) => {
        const result = parseKstDateYYYYMMDD(input);
        
        expect(result.getFullYear()).toBe(expected.year);
        expect(result.getMonth()).toBe(expected.month);
        expect(result.getDate()).toBe(expected.date);
      });
    });
  });

  describe('formatKstDateTime', () => {
    it('should format date time in KST format', () => {
      const utcDate = new Date('2024-01-01T00:00:00.000Z');
      const result = formatKstDateTime(utcDate);
      
      // Should be formatted in Korean locale
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
    });

    it('should handle different times', () => {
      const testDate = new Date('2024-06-15T15:30:45.000Z');
      const result = formatKstDateTime(testDate);
      
      expect(typeof result).toBe('string');
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
    });
  });

  describe('formatKstDate', () => {
    it('should format date in YYYY-MM-DD format', () => {
      const utcDate = new Date('2024-01-01T00:00:00.000Z');
      const result = formatKstDate(utcDate);
      
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('should handle different dates', () => {
      const testCases = [
        '2024-01-01T00:00:00.000Z',
        '2024-12-31T23:59:59.999Z',
        '2023-06-15T12:30:00.000Z'
      ];

      testCases.forEach(dateString => {
        const date = new Date(dateString);
        const result = formatKstDate(date);
        
        expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        expect(result.length).toBe(10);
      });
    });
  });
});