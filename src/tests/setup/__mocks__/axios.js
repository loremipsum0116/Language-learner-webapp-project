// Smart axios mock for contract tests - allows Pact mock server requests through
let originalAxios;
try {
  originalAxios = jest.requireActual('axios');
  // Handle case where axios exports are different
  if (originalAxios.default) {
    originalAxios = originalAxios.default;
  }
} catch (error) {
  console.warn('Failed to load original axios, using require fallback:', error);
  originalAxios = require.cache[require.resolve('axios')] ? require.cache[require.resolve('axios')].exports : null;
}

// Function to check if URL is a Pact mock server
const isPactMockServer = (url) => {
  if (typeof url === 'string') {
    // Check for localhost with ports in Pact range (typically 9000-60000)
    return /https?:\/\/(127\.0\.0\.1|localhost):[0-9]{4,5}\//.test(url);
  }
  return false;
};

const axios = {
  create: jest.fn(() => axios),
  get: jest.fn((url, config) => {
    // If it's a Pact mock server request, use real axios
    if (isPactMockServer(url)) {
      console.log('[AXIOS MOCK] Allowing Pact request through:', url);
      if (originalAxios && typeof originalAxios.get === 'function') {
        return originalAxios.get(url, config);
      } else {
        console.error('[AXIOS MOCK] Original axios not available, using mock');
        return Promise.resolve({ data: {} });
      }
    }
    // Otherwise use mock response
    console.log('[AXIOS MOCK] Mocking request:', url);
    return Promise.resolve({ data: {} });
  }),
  post: jest.fn((url, data, config) => {
    if (isPactMockServer(url)) {
      console.log('[AXIOS MOCK] Allowing Pact POST through:', url);
      if (originalAxios && typeof originalAxios.post === 'function') {
        return originalAxios.post(url, data, config);
      }
    }
    return Promise.resolve({ data: {} });
  }),
  put: jest.fn((url, data, config) => {
    if (isPactMockServer(url)) {
      console.log('[AXIOS MOCK] Allowing Pact PUT through:', url);
      if (originalAxios && typeof originalAxios.put === 'function') {
        return originalAxios.put(url, data, config);
      }
    }
    return Promise.resolve({ data: {} });
  }),
  delete: jest.fn((url, config) => {
    if (isPactMockServer(url)) {
      console.log('[AXIOS MOCK] Allowing Pact DELETE through:', url);
      if (originalAxios && typeof originalAxios.delete === 'function') {
        return originalAxios.delete(url, config);
      }
    }
    return Promise.resolve({ data: {} });
  }),
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