function ok(res, data, meta) {
  return res.json(meta ? { data, meta } : { data });
}

function fail(res, status, message) {
  return res.status(status).json({ error: message || 'error' });
}
module.exports = { ok, fail };
