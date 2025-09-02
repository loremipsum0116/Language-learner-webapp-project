// Mock axios for contract tests
const axios = {
  create: jest.fn(() => axios),
  get: jest.fn(() => Promise.resolve({ data: {} })),
  post: jest.fn(() => Promise.resolve({ data: {} })),
  put: jest.fn(() => Promise.resolve({ data: {} })),
  delete: jest.fn(() => Promise.resolve({ data: {} })),
  defaults: {
    headers: {
      common: {}
    }
  },
  interceptors: {
    request: {
      use: jest.fn(),
      eject: jest.fn()
    },
    response: {
      use: jest.fn(),
      eject: jest.fn()
    }
  }
};

module.exports = axios;
module.exports.default = axios;