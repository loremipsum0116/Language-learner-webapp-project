// lib/validation.test.js
const {
  isValidEmail,
  isValidPassword,
  isNotEmpty,
  isPositiveInteger,
  hasItems,
  sanitizeString,
  hasRequiredProperties,
  isValidId
} = require('./validation');

describe('Validation Utilities', () => {
  describe('isValidEmail', () => {
    it('should validate correct email addresses', () => {
      const validEmails = [
        'test@example.com',
        'user.name@domain.co.uk',
        'user+tag@example.org',
        'user123@test-domain.com'
      ];

      validEmails.forEach(email => {
        expect(isValidEmail(email)).toBe(true);
      });
    });

    it('should reject invalid email addresses', () => {
      const invalidEmails = [
        'invalid-email',
        '@domain.com',
        'user@',
        'user@@domain.com',
        'user@domain',
        '',
        null,
        undefined,
        123
      ];

      invalidEmails.forEach(email => {
        expect(isValidEmail(email)).toBe(false);
      });
    });
  });

  describe('isValidPassword', () => {
    it('should accept valid passwords', () => {
      const validPasswords = [
        'password123',
        'mySecretPass',
        '123456',
        'a'.repeat(6)
      ];

      validPasswords.forEach(password => {
        expect(isValidPassword(password)).toBe(true);
      });
    });

    it('should reject invalid passwords', () => {
      const invalidPasswords = [
        'short',
        '12345',
        '',
        null,
        undefined,
        123
      ];

      invalidPasswords.forEach(password => {
        expect(isValidPassword(password)).toBe(false);
      });
    });
  });

  describe('isNotEmpty', () => {
    it('should return true for non-empty strings', () => {
      expect(isNotEmpty('hello')).toBe(true);
      expect(isNotEmpty(' hello ')).toBe(true);
      expect(isNotEmpty('a')).toBe(true);
    });

    it('should return false for empty or invalid strings', () => {
      expect(isNotEmpty('')).toBe(false);
      expect(isNotEmpty('   ')).toBe(false);
      expect(isNotEmpty(null)).toBe(false);
      expect(isNotEmpty(undefined)).toBe(false);
      expect(isNotEmpty(123)).toBe(false);
    });
  });

  describe('isPositiveInteger', () => {
    it('should return true for positive integers', () => {
      expect(isPositiveInteger(1)).toBe(true);
      expect(isPositiveInteger(100)).toBe(true);
      expect(isPositiveInteger(999999)).toBe(true);
    });

    it('should return false for non-positive integers', () => {
      expect(isPositiveInteger(0)).toBe(false);
      expect(isPositiveInteger(-1)).toBe(false);
      expect(isPositiveInteger(1.5)).toBe(false);
      expect(isPositiveInteger('1')).toBe(false);
      expect(isPositiveInteger(null)).toBe(false);
    });
  });

  describe('hasItems', () => {
    it('should return true for arrays with items', () => {
      expect(hasItems([1, 2, 3])).toBe(true);
      expect(hasItems(['hello'])).toBe(true);
      expect(hasItems([null])).toBe(true);
    });

    it('should return false for empty or invalid arrays', () => {
      expect(hasItems([])).toBe(false);
      expect(hasItems(null)).toBe(false);
      expect(hasItems(undefined)).toBe(false);
      expect(hasItems('array')).toBe(false);
      expect(hasItems({})).toBe(false);
    });
  });

  describe('sanitizeString', () => {
    it('should trim and limit string length', () => {
      expect(sanitizeString('  hello  ')).toBe('hello');
      expect(sanitizeString('a'.repeat(300), 10)).toBe('a'.repeat(10));
    });

    it('should handle invalid inputs', () => {
      expect(sanitizeString(null)).toBe('');
      expect(sanitizeString(undefined)).toBe('');
      expect(sanitizeString(123)).toBe('');
    });

    it('should use default max length', () => {
      const longString = 'a'.repeat(300);
      expect(sanitizeString(longString)).toBe('a'.repeat(255));
    });
  });

  describe('hasRequiredProperties', () => {
    it('should return true when object has all required properties', () => {
      const obj = { name: 'test', age: 25, email: 'test@example.com' };
      expect(hasRequiredProperties(obj, ['name', 'age'])).toBe(true);
      expect(hasRequiredProperties(obj, ['email'])).toBe(true);
    });

    it('should return false when missing required properties', () => {
      const obj = { name: 'test', age: 25 };
      expect(hasRequiredProperties(obj, ['name', 'email'])).toBe(false);
      expect(hasRequiredProperties(obj, ['missing'])).toBe(false);
    });

    it('should handle invalid objects', () => {
      expect(hasRequiredProperties(null, ['name'])).toBe(false);
      expect(hasRequiredProperties(undefined, ['name'])).toBe(false);
      expect(hasRequiredProperties('string', ['name'])).toBe(false);
    });

    it('should handle empty requirements', () => {
      expect(hasRequiredProperties({}, [])).toBe(true);
      expect(hasRequiredProperties({ name: 'test' }, [])).toBe(true);
    });
  });

  describe('isValidId', () => {
    it('should return true for valid IDs', () => {
      expect(isValidId(1)).toBe(true);
      expect(isValidId('123')).toBe(true);
      expect(isValidId(999)).toBe(true);
    });

    it('should return false for invalid IDs', () => {
      expect(isValidId(0)).toBe(false);
      expect(isValidId(-1)).toBe(false);
      expect(isValidId('abc')).toBe(false);
      expect(isValidId(null)).toBe(false);
      expect(isValidId(undefined)).toBe(false);
      expect(isValidId('')).toBe(false);
    });
  });
});