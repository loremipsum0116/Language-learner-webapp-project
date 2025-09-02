// middleware/compression.js - Advanced Compression and Response Optimization
const compression = require('compression');
const { promisify } = require('util');
const zlib = require('zlib');

/**
 * Advanced compression middleware with intelligent content-type detection
 */
const advancedCompression = compression({
  level: 6, // Balanced compression level
  threshold: 1024, // Only compress files larger than 1KB
  filter: (req, res) => {
    // Skip compression for already compressed content
    if (req.headers['x-no-compression']) return false;
    
    const contentType = res.getHeader('Content-Type');
    if (!contentType) return true;
    
    // Skip binary content that's already compressed
    const skipTypes = [
      'image/', 'video/', 'audio/',
      'application/pdf', 'application/zip',
      'application/gzip', 'application/x-rar'
    ];
    
    if (skipTypes.some(type => contentType.includes(type))) {
      return false;
    }
    
    // Compress text-based content
    const compressTypes = [
      'text/', 'application/json', 'application/javascript',
      'application/xml', 'application/rss+xml',
      'application/atom+xml', 'application/soap+xml'
    ];
    
    return compressTypes.some(type => contentType.includes(type)) || 
           compression.filter(req, res);
  },
  
  // Custom compression strategy based on content size
  strategy: (req, res) => {
    const contentLength = res.getHeader('Content-Length');
    
    if (contentLength && parseInt(contentLength) > 50000) {
      // Large content: use maximum compression
      return zlib.constants.Z_DEFAULT_STRATEGY;
    } else {
      // Small content: prioritize speed
      return zlib.constants.Z_FILTERED;
    }
  }
});

/**
 * API Response Size Optimization
 * Removes unnecessary fields based on client capabilities
 */
const apiResponseOptimization = (req, res, next) => {
  const originalJson = res.json;
  
  res.json = function(data) {
    // Skip optimization for non-API routes
    if (!req.path.startsWith('/api/')) {
      return originalJson.call(this, data);
    }
    
    // Network-aware optimization
    const networkType = req.headers['x-network-type'];
    const optimizeForSlowNetwork = ['slow-2g', '2g', '3g'].includes(networkType);
    
    // Mobile-specific optimization
    const isMobile = req.path.startsWith('/api/mobile/') || 
                    req.headers['x-platform'] || 
                    req.deviceInfo?.isMobile;
    
    let optimizedData = data;
    
    // Apply optimizations based on context
    if (optimizeForSlowNetwork || isMobile) {
      optimizedData = optimizeApiResponse(data, {
        removeNulls: true,
        truncateStrings: optimizeForSlowNetwork,
        limitArrays: optimizeForSlowNetwork,
        removeDebugInfo: true
      });
    }
    
    // Add compression info to response headers
    if (optimizedData !== data) {
      res.set('X-Response-Optimized', 'true');
      res.set('X-Optimization-Level', optimizeForSlowNetwork ? 'aggressive' : 'standard');
    }
    
    return originalJson.call(this, optimizedData);
  };
  
  next();
};

/**
 * Optimize API response data
 */
function optimizeApiResponse(data, options = {}) {
  const {
    removeNulls = false,
    truncateStrings = false,
    limitArrays = false,
    removeDebugInfo = false
  } = options;
  
  if (!data || typeof data !== 'object') {
    return data;
  }
  
  // Deep clone to avoid mutating original data
  const optimized = JSON.parse(JSON.stringify(data));
  
  return optimizeObject(optimized, options);
}

function optimizeObject(obj, options) {
  if (!obj || typeof obj !== 'object') {
    return obj;
  }
  
  if (Array.isArray(obj)) {
    // Limit array size for slow networks
    if (options.limitArrays && obj.length > 20) {
      obj = obj.slice(0, 20);
    }
    
    return obj.map(item => optimizeObject(item, options));
  }
  
  const optimized = {};
  
  for (const [key, value] of Object.entries(obj)) {
    // Remove null/undefined values
    if (options.removeNulls && (value === null || value === undefined)) {
      continue;
    }
    
    // Remove debug information
    if (options.removeDebugInfo && 
        ['__debug', '_meta', 'debugInfo', 'trace', 'stack'].includes(key)) {
      continue;
    }
    
    // Truncate long strings
    if (options.truncateStrings && typeof value === 'string' && value.length > 200) {
      optimized[key] = value.substring(0, 197) + '...';
    } else if (typeof value === 'object') {
      optimized[key] = optimizeObject(value, options);
    } else {
      optimized[key] = value;
    }
  }
  
  return optimized;
}

/**
 * Content-Type specific optimization
 */
const contentTypeOptimization = (req, res, next) => {
  // Override setHeader to add optimization hints
  const originalSetHeader = res.setHeader;
  
  res.setHeader = function(name, value) {
    if (name.toLowerCase() === 'content-type') {
      // Add charset for text content
      if (value.startsWith('text/') && !value.includes('charset')) {
        value = `${value}; charset=utf-8`;
      }
      
      // Add optimization headers for JSON
      if (value.includes('application/json')) {
        res.set('X-Content-Optimized', 'json');
        res.set('Vary', 'Accept-Encoding, X-Network-Type');
      }
    }
    
    return originalSetHeader.call(this, name, value);
  };
  
  next();
};

/**
 * Response size monitoring
 */
const responseSizeMonitoring = (req, res, next) => {
  if (process.env.NODE_ENV === 'production') {
    return next();
  }
  
  const originalEnd = res.end;
  const startTime = Date.now();
  
  res.end = function(chunk, encoding) {
    const responseTime = Date.now() - startTime;
    const responseSize = chunk ? Buffer.byteLength(chunk, encoding) : 0;
    
    // Log large responses in development
    if (responseSize > 100000) { // 100KB+
      console.warn(`[COMPRESSION] Large response detected: ${req.method} ${req.path} - ${(responseSize/1024).toFixed(2)}KB in ${responseTime}ms`);
    }
    
    // Add response size headers
    res.set('X-Response-Size', responseSize.toString());
    res.set('X-Response-Time', `${responseTime}ms`);
    
    return originalEnd.call(this, chunk, encoding);
  };
  
  next();
};

/**
 * Cache optimization for API responses
 */
const apiCacheOptimization = (req, res, next) => {
  // Skip non-GET requests
  if (req.method !== 'GET') {
    return next();
  }
  
  // API-specific cache headers
  if (req.path.startsWith('/api/')) {
    const isPublicEndpoint = [
      '/api/v1/dict',
      '/api/v1/exam-vocab',
      '/api/v1/reading',
      '/api/mobile/app-info'
    ].some(endpoint => req.path.startsWith(endpoint));
    
    if (isPublicEndpoint) {
      // Public API endpoints - longer cache
      res.set('Cache-Control', 'public, max-age=3600, s-maxage=7200'); // 1h client, 2h CDN
      res.set('Vary', 'Accept-Encoding, Accept-Language');
    } else {
      // Private API endpoints - short cache
      res.set('Cache-Control', 'private, max-age=300'); // 5 minutes
    }
    
    // Add ETag for better caching
    res.set('ETag', `"api-${Date.now().toString(36)}"`);
  }
  
  next();
};

/**
 * Brotli compression for modern browsers
 */
const brotliCompression = (req, res, next) => {
  const acceptEncoding = req.headers['accept-encoding'] || '';
  
  // Only use Brotli for modern browsers that support it
  if (acceptEncoding.includes('br') && 
      req.headers['user-agent'] && 
      !req.headers['user-agent'].includes('curl')) {
    
    // Enable Brotli for text-based content
    const originalJson = res.json;
    res.json = function(data) {
      res.set('Content-Encoding', 'br');
      return originalJson.call(this, data);
    };
  }
  
  next();
};

module.exports = {
  advancedCompression,
  apiResponseOptimization,
  contentTypeOptimization,
  responseSizeMonitoring,
  apiCacheOptimization,
  brotliCompression
};