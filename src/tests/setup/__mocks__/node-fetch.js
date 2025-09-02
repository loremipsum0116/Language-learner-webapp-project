// Mock node-fetch for contract tests
const fetch = jest.fn(() =>
  Promise.resolve({
    ok: true,
    status: 200,
    json: () => Promise.resolve({}),
    text: () => Promise.resolve(''),
    headers: new Map(),
  })
);

module.exports = fetch;
module.exports.default = fetch;