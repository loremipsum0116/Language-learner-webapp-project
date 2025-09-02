// Smart node-fetch mock for contract tests - allows Pact mock server requests through
let originalFetch;
try {
  originalFetch = jest.requireActual('node-fetch');
  // Handle default export
  if (originalFetch.default) {
    originalFetch = originalFetch.default;
  }
} catch (error) {
  console.warn('Failed to load original node-fetch:', error.message);
  // Fallback to native fetch if available
  originalFetch = global.fetch || require('node:http');
}

// Function to check if URL is a Pact mock server
const isPactMockServer = (url) => {
  if (typeof url === 'string') {
    // Check for localhost with ports in Pact range (typically 9000-60000)
    return /https?:\/\/(127\.0\.0\.1|localhost):[0-9]{4,5}\//.test(url);
  }
  return false;
};

const fetch = jest.fn((url, options) => {
  // If it's a Pact mock server request, use real fetch
  if (isPactMockServer(url)) {
    console.log('[FETCH MOCK] Allowing Pact request through:', url);
    if (originalFetch && typeof originalFetch === 'function') {
      return originalFetch(url, options);
    } else {
      console.warn('[FETCH MOCK] Original fetch not available, using mock');
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({}),
        text: () => Promise.resolve(''),
        headers: new Map(),
      });
    }
  }
  
  // Otherwise use mock response
  console.log('[FETCH MOCK] Mocking request:', url);
  return Promise.resolve({
    ok: true,
    status: 200,
    json: () => Promise.resolve({}),
    text: () => Promise.resolve(''),
    headers: new Map(),
  });
});

module.exports = fetch;
module.exports.default = fetch;