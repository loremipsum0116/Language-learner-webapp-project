// Simple contract test to verify CI setup
const { Pact } = require('@pact-foundation/pact');
const path = require('path');
const http = require('http');
const { getNextAvailablePort } = require('../setup/port-utils');

// Simple HTTP request helper
const makeRequest = (url) => {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const req = http.request({
      hostname: parsedUrl.hostname,
      port: parsedUrl.port,
      path: parsedUrl.pathname,
      method: 'GET'
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({
          status: res.statusCode,
          data: data ? JSON.parse(data) : {}
        });
      });
    });
    req.on('error', reject);
    req.end();
  });
};

describe('Simple Consumer Contract Test', () => {
  let provider;
  let mockServerPort;

  beforeAll(async () => {
    mockServerPort = await getNextAvailablePort();
    provider = new Pact({
      consumer: 'Language-Learner-Client',
      provider: 'Language-Learner-API',
      port: mockServerPort,
      log: path.resolve(process.cwd(), 'logs', 'simple-test.log'),
      dir: path.resolve(process.cwd(), 'pacts'),
      logLevel: 'INFO'
    });

    console.log(`Setting up Pact provider on port ${mockServerPort}`);
    await provider.setup();
  });

  afterAll(async () => {
    console.log('Finalizing Pact provider...');
    await provider.finalize();
  });

  it('should make a simple successful request', async () => {
    await provider.addInteraction({
      state: 'service is available',
      uponReceiving: 'a simple health check request',
      withRequest: {
        method: 'GET',
        path: '/health'
      },
      willRespondWith: {
        status: 200,
        body: { status: 'ok' }
      }
    });

    const response = await makeRequest(`http://127.0.0.1:${mockServerPort}/health`);
    
    expect(response.status).toBe(200);
    expect(response.data.status).toBe('ok');

    await provider.verify();
  });
});