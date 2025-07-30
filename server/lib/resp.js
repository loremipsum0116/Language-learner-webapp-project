// server/lib/resp.js
function ok(res, data, meta) {
  return res.json({ data, ...(meta ? { meta } : {}) });
}
function fail(res, status, message) {
  return res.status(status).json({ error: message || 'error' });
}
module.exports = { ok, fail };
