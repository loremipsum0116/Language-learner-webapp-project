// Smart node-fetch mock for contract tests - allows Pact mock server requests through
const originalFetch = jest.requireActual('node-fetch');

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
    return originalFetch(url, options);
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