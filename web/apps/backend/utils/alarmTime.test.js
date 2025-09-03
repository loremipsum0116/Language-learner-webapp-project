// utils/alarmTime.test.js
const { nextAlarmSlot } = require('./alarmTime');
const dayjs = require('dayjs');
const utc = require('dayjs/plugin/utc');
const tz = require('dayjs/plugin/timezone');

dayjs.extend(utc);
dayjs.extend(tz);

describe('alarmTime utilities', () => {
  describe('nextAlarmSlot', () => {
    it('should return next alarm slot within same day', () => {
      // Test at 9 AM KST - should return 12 PM (noon) same day
      const morning = dayjs('2024-01-01T09:00:00').tz('Asia/Seoul');
      const result = nextAlarmSlot(morning);
      
      expect(result.hour()).toBe(12);
      expect(result.minute()).toBe(0);
      expect(result.second()).toBe(0);
      expect(result.millisecond()).toBe(0);
      expect(result.date()).toBe(1); // Same day
    });

    it('should return 18:00 when current time is 14:00', () => {
      const afternoon = dayjs('2024-01-01T14:00:00').tz('Asia/Seoul');
      const result = nextAlarmSlot(afternoon);
      
      expect(result.hour()).toBe(18);
      expect(result.date()).toBe(1);
    });

    it('should return next day 00:00 when current time is after 18:00', () => {
      const evening = dayjs('2024-01-01T20:00:00').tz('Asia/Seoul');
      const result = nextAlarmSlot(evening);
      
      expect(result.hour()).toBe(0);
      expect(result.date()).toBe(2); // Next day
    });

    it('should handle exact slot times', () => {
      const testCases = [
        { time: '06:00:00', expectedHour: 12, expectedDate: 1 },
        { time: '12:00:00', expectedHour: 18, expectedDate: 1 },
        { time: '18:00:00', expectedHour: 0, expectedDate: 2 }, // Next day
        { time: '00:00:00', expectedHour: 6, expectedDate: 1 }
      ];

      testCases.forEach(({ time, expectedHour, expectedDate }) => {
        const testTime = dayjs(`2024-01-01T${time}`).tz('Asia/Seoul');
        const result = nextAlarmSlot(testTime);
        
        expect(result.hour()).toBe(expectedHour);
        expect(result.date()).toBe(expectedDate);
        expect(result.minute()).toBe(0);
        expect(result.second()).toBe(0);
      });
    });

    it('should handle edge cases around midnight', () => {
      const lateNight = dayjs('2024-01-01T23:59:00').tz('Asia/Seoul');
      const result = nextAlarmSlot(lateNight);
      
      expect(result.hour()).toBe(0);
      expect(result.date()).toBe(2); // Next day
    });

    it('should handle different time zones correctly', () => {
      // Create time in different timezone but convert to KST
      const utcTime = dayjs('2024-01-01T01:00:00Z'); // 10 AM KST
      const result = nextAlarmSlot(utcTime);
      
      // Should still work because function converts to KST internally
      expect(result.hour()).toBe(12);
    });

    it('should use current time when no parameter provided', () => {
      const result = nextAlarmSlot();
      
      expect(result).toBeDefined();
      expect([0, 6, 12, 18].includes(result.hour())).toBe(true);
    });

    it('should handle month/year boundaries', () => {
      const endOfYear = dayjs('2024-12-31T20:00:00').tz('Asia/Seoul');
      const result = nextAlarmSlot(endOfYear);
      
      expect(result.hour()).toBe(0);
      expect(result.date()).toBe(1);
      expect(result.month()).toBe(0); // January (0-indexed)
      expect(result.year()).toBe(2025);
    });

    it('should handle end of month', () => {
      const endOfMonth = dayjs('2024-01-31T19:00:00').tz('Asia/Seoul');
      const result = nextAlarmSlot(endOfMonth);
      
      expect(result.hour()).toBe(0);
      expect(result.date()).toBe(1);
      expect(result.month()).toBe(1); // February (0-indexed)
    });

    it('should clear minutes, seconds, and milliseconds', () => {
      const timeWithDetails = dayjs('2024-01-01T09:45:30.123').tz('Asia/Seoul');
      const result = nextAlarmSlot(timeWithDetails);
      
      expect(result.minute()).toBe(0);
      expect(result.second()).toBe(0);
      expect(result.millisecond()).toBe(0);
    });

    it('should handle all possible hours in a day', () => {
      for (let hour = 0; hour < 24; hour++) {
        const testTime = dayjs(`2024-01-01T${hour.toString().padStart(2, '0')}:00:00`).tz('Asia/Seoul');
        const result = nextAlarmSlot(testTime);
        
        // Verify result is always one of the valid slots
        expect([0, 6, 12, 18].includes(result.hour())).toBe(true);
        
        // Verify time components are reset
        expect(result.minute()).toBe(0);
        expect(result.second()).toBe(0);
        expect(result.millisecond()).toBe(0);
        
        // Verify date logic
        if (hour < 18) {
          expect(result.date()).toBe(1); // Same day
        } else {
          expect(result.date()).toBe(2); // Next day
        }
      }
    });
  });
});