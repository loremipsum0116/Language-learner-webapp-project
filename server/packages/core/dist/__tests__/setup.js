"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// Test setup file for Jest
const dayjs_1 = __importDefault(require("dayjs"));
// Set timezone for consistent test results
process.env.TZ = 'UTC';
// Mock Date.now for consistent testing
const mockNow = (0, dayjs_1.default)('2024-01-01T00:00:00Z').valueOf();
jest.spyOn(Date, 'now').mockReturnValue(mockNow);
// Custom Jest matchers
expect.extend({
    toBeWithinRange(received, min, max) {
        const pass = received >= min && received <= max;
        if (pass) {
            return {
                message: () => `Expected ${received} not to be within range ${min} - ${max}`,
                pass: true,
            };
        }
        else {
            return {
                message: () => `Expected ${received} to be within range ${min} - ${max}`,
                pass: false,
            };
        }
    },
});
// Mock console methods in tests to reduce noise
global.console = {
    ...console,
    log: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
};
//# sourceMappingURL=setup.js.map