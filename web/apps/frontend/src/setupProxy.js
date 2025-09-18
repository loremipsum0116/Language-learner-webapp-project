const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = function(app) {
  app.use(
    '/api',
    createProxyMiddleware({
      target: 'http://localhost:4000',
      changeOrigin: true,
      onProxyReq: (proxyReq, req, res) => {
        console.log(`[PROXY] ${req.method} ${req.url} -> http://localhost:4000${req.url}`);
      },
      onProxyRes: (proxyRes, req, res) => {
        console.log(`[PROXY] Response ${proxyRes.statusCode} for ${req.method} ${req.url}`);
      },
      onError: (err, req, res) => {
        console.error(`[PROXY ERROR] ${req.method} ${req.url}:`, err.message);
      }
    })
  );
};